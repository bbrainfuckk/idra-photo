import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { FakeHost, runSimulatedBatch, type Step } from '../../src/sim/fakeHost.js';
import { makePng } from '../../src/sim/fixtures.js';
import { sha256Hex } from '../../src/core/ids.js';
import { CLI, REPO_ROOT, refPng, tmpWorkspace } from '../helpers.js';

test('stdout carries only JSON-RPC; tools/list exposes exactly seven annotated tools', async () => {
  const ws = tmpWorkspace();
  const child = spawn(process.execPath, [CLI, 'serve', '--workspace', ws], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  let err = '';
  child.stdout.on('data', (d: Buffer) => (out += d.toString()));
  child.stderr.on('data', (d: Buffer) => (err += d.toString()));
  const send = (m: object) => child.stdin.write(JSON.stringify(m) + '\n');
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'idra_status', arguments: {} } });
  send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'idra_step', arguments: { batch_id: '../../x' } } });
  const deadline = Date.now() + 15000;
  while (out.split('\n').filter(Boolean).length < 4 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  child.stdin.end();
  child.kill();
  const lines = out.split('\n').filter(Boolean);
  assert.equal(lines.length, 4, `stderr: ${err}`);
  const msgs = lines.map((l) => JSON.parse(l) as { jsonrpc: string; id: number; result?: Record<string, unknown> });
  for (const m of msgs) assert.equal(m.jsonrpc, '2.0');
  const init = msgs.find((m) => m.id === 1)!.result!;
  assert.match(String(init['instructions']), /image_gen/);
  const tools = (msgs.find((m) => m.id === 2)!.result!['tools'] as { name: string; annotations: { readOnlyHint?: boolean } }[]).sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(
    tools.map((t) => t.name),
    ['idra_control_batch', 'idra_create_batch', 'idra_extend', 'idra_reconcile', 'idra_report_problem', 'idra_status', 'idra_step'],
  );
  for (const t of tools) assert.equal(t.annotations.readOnlyHint, t.name === 'idra_status');
  const bad = msgs.find((m) => m.id === 4)!.result! as { isError?: boolean };
  assert.equal(bad.isError, true, 'malformed ids are rejected by schema validation');
});

test('simulated 100-job batch over stdio: 100 distinct validated outputs matching the manifest', async () => {
  const ws = tmpWorkspace();
  const ref = refPng(ws, 'look.png', 3);
  const r = await runSimulatedBatch({ cliPath: CLI, workspace: ws, count: 100, referencePath: ref });
  assert.equal(r.final.status, 'done');
  assert.equal(r.final.progress, '100/100');
  assert.equal(r.generated, 100);
  assert.equal(r.metrics.calls['idra_create_batch'], 1);
  assert.equal(r.metrics.calls['idra_step'], 101);
  const outDir = fs.readdirSync(path.join(ws, 'outputs')).map((d) => path.join(ws, 'outputs', d))[0]!;
  const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.png'));
  assert.equal(files.length, 100);
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8')) as { simulated: boolean; counts: { completed: number }; jobs: { seq: number; artifact: { file: string; sha256: string } }[] };
  assert.equal(manifest.simulated, true);
  assert.equal(manifest.counts.completed, 100);
  const hashes = new Set<string>();
  for (const j of manifest.jobs) {
    const actual = sha256Hex(fs.readFileSync(path.join(outDir, j.artifact.file)));
    assert.equal(actual, j.artifact.sha256, `hash mismatch for #${j.seq}`);
    hashes.add(actual);
  }
  assert.equal(hashes.size, 100);
});

test('process killed after an image was saved but before it was reported: resume adopts it and finishes', async () => {
  const ws = tmpWorkspace();
  const first = await runSimulatedBatch({ cliPath: CLI, workspace: ws, count: 12, interruptAfter: 7 });
  assert.equal(first.interrupted, true);
  const host = await FakeHost.connect({ cliPath: CLI, workspace: ws, extraArgs: ['--simulation'] });
  const blocked = (await host.call<Step>('idra_step', { batch_id: first.batchId })).data;
  assert.equal(blocked.reason, 'job_in_progress');
  const jobId = (blocked as unknown as { detail: { job_id: string } }).detail.job_id;
  const rec = (await host.call('idra_reconcile', { batch_id: first.batchId, job_id: jobId, action: 'check' })).data;
  assert.equal(rec['state'], 'completed');
  let r = (await host.call<Step>('idra_step', { batch_id: first.batchId })).data;
  assert.equal(r.job?.seq, 8);
  while (r.status === 'job' && r.job) {
    fs.writeFileSync(r.job.save_to, makePng(64, 80, r.job.seq * 7919 + 13));
    r = (await host.call<Step>('idra_step', { batch_id: first.batchId, completed: { job_id: r.job.job_id, attempt_token: r.job.attempt_token } })).data;
  }
  assert.equal(r.status, 'done');
  assert.equal(r.progress, '12/12');
  const st = (await host.call('idra_status', { batch_id: first.batchId })).data;
  assert.equal(st['state'], 'done');
  await host.close();
});

test('concurrent sessions: several processes stepping at once claim exactly one job', async () => {
  const ws = tmpWorkspace();
  const host = await FakeHost.connect({ cliPath: CLI, workspace: ws });
  const created = (await host.call('idra_create_batch', { idempotency_key: 'race', request: 'r', count: 5, base_prompt: 'p' })).data;
  await host.close();
  const hosts = await Promise.all(Array.from({ length: 6 }, () => FakeHost.connect({ cliPath: CLI, workspace: ws })));
  const results = await Promise.all(hosts.map((h) => h.call<Step>('idra_step', { batch_id: created['batch_id'] })));
  await Promise.all(hosts.map((h) => h.close()));
  const jobs = results.filter((r) => r.data.status === 'job');
  assert.equal(jobs.length, 1, JSON.stringify(results.map((r) => r.data.status)));
  assert.ok(results.every((r) => r.data.status === 'job' || r.data.reason === 'job_in_progress'));
});

test('runs with all network access blocked', async () => {
  const ws = tmpWorkspace();
  const preload = path.join(REPO_ROOT, 'tests', 'fixtures', 'no-network.cjs');
  const host = await FakeHost.connect({ cliPath: CLI, workspace: ws, extraArgs: ['--simulation'], nodeArgs: ['--require', preload] });
  const c = (await host.call('idra_create_batch', { idempotency_key: 'net', request: 'r', count: 3, base_prompt: 'p' })).data;
  let r = (await host.call<Step>('idra_step', { batch_id: c['batch_id'] })).data;
  while (r.status === 'job' && r.job) {
    fs.writeFileSync(r.job.save_to, makePng(64, 80, r.job.seq));
    r = (await host.call<Step>('idra_step', { batch_id: c['batch_id'], completed: { job_id: r.job.job_id, attempt_token: r.job.attempt_token } })).data;
  }
  assert.equal(r.status, 'done');
  assert.match(host.stderr, /network blocked for test/);
  await host.close();
});

test('source has no image API client, credential handling, or runtime network code', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.ts')) files.push(p);
    }
  };
  walk(path.join(REPO_ROOT, 'src'));
  const banned = [/from ['"]node:(https?|net|dns|tls|http2)['"]/, /\bfetch\(/, /OPENAI_API_KEY|api[_-]?key/i, /from ['"]openai['"]/, /auth\.json/, /\bXMLHttpRequest\b/, /\bWebSocket\b/];
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    for (const re of banned) assert.doesNotMatch(s, re, `${path.relative(REPO_ROOT, f)} matches ${re}`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@modelcontextprotocol/sdk', 'zod']);
});

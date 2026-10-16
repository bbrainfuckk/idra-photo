import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runSimulatedBatch } from '../../src/sim/fakeHost.js';
import { removeTomlServer } from '../../src/main.js';
import { CLI, REPO_ROOT, tmpWorkspace } from '../helpers.js';

const EXISTING = `model = "some-model"
# my comment stays

[mcp_servers.other]
command = 'C:\tools\other.exe'
args = ["x"]

[mcp_servers.other.env]
TOKEN_NAME = "keep-me"
`;

function run(args: string[], codexHome: string) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: codexHome } });
}

test('install-codex without a Codex CLI edits config.toml safely, idempotently, and uninstall restores it', () => {
  const home = tmpWorkspace('idra-codexhome-');
  const ws = path.join(tmpWorkspace(), 'Idra Photo');
  const cfg = path.join(home, 'config.toml');
  fs.writeFileSync(cfg, EXISTING);
  for (let i = 0; i < 2; i++) {
    const r = run(['install-codex', '--codex', 'none', '--workspace', ws], home);
    assert.equal(r.status, 0, r.stderr);
  }
  const text = fs.readFileSync(cfg, 'utf8');
  assert.ok(text.startsWith(EXISTING.trimEnd()), 'existing settings are kept byte for byte');
  assert.equal(text.match(/^\[mcp_servers\.idra_photo\]$/gm)?.length, 1, 'exactly one entry after two installs');
  assert.match(text, /IDRA_WORKSPACE = ".*Idra Photo"/);
  assert.ok(fs.existsSync(path.join(ws, 'references')));
  assert.ok(fs.existsSync(path.join(home, 'skills', 'idra-photo', 'SKILL.md')), 'installs the portable skill with the MCP');
  assert.ok(fs.readdirSync(home).some((f) => f.startsWith('config.toml.bak-idra-')), 'a backup is written before editing');
  const u = run(['uninstall-codex', '--codex', 'none'], home);
  assert.equal(u.status, 0, u.stderr);
  assert.equal(fs.readFileSync(cfg, 'utf8').trimEnd(), EXISTING.trimEnd());
});

test('Claude project install preserves other MCPs, installs the skill, and can launch the server', async () => {
  const project = tmpWorkspace('idra-claude-');
  const ws = path.join(project, 'images');
  const config = path.join(project, '.mcp.json');
  fs.writeFileSync(config, JSON.stringify({ extra: true, mcpServers: { other: { command: 'keep-me' } } }));
  for (let i = 0; i < 2; i++) {
    const r = run(['install-claude', '--project', project, '--workspace', ws], path.join(project, 'codex-unused'));
    assert.equal(r.status, 0, r.stderr);
  }
  const saved = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.equal(saved.extra, true);
  assert.equal(saved.mcpServers.other.command, 'keep-me');
  assert.equal(saved.mcpServers.idra_photo.type, 'stdio');
  assert.ok(fs.existsSync(path.join(project, '.claude', 'skills', 'idra-photo', 'SKILL.md')));
  const { FakeHost } = await import('../../src/sim/fakeHost.js');
  const spec = saved.mcpServers.idra_photo;
  const host = await FakeHost.connect({ cliPath: CLI, command: spec.command, args: spec.args, env: spec.env });
  try {
    const brief = await host.call('idra_design_brief', { request: 'Make 2 skincare photos.' });
    assert.equal(brief.isError, false);
    assert.equal((brief.data['create_batch'] as { count: number }).count, 2);
  } finally { await host.close(); }
  const u = run(['uninstall-claude', '--project', project], path.join(project, 'codex-unused'));
  assert.equal(u.status, 0, u.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(config, 'utf8')).mcpServers, { other: { command: 'keep-me' } });
});

test('removeTomlServer only removes its own tables', () => {
  const t = `[a]\nx = 1\n[mcp_servers.idra_photo]\ncommand = "n"\n[mcp_servers.idra_photo.env]\nK = "v"\n[mcp_servers.idra_photo_extra]\nkeep = true\n`;
  const out = removeTomlServer(t, 'idra_photo');
  assert.doesNotMatch(out, /command = "n"|K = "v"/);
  assert.match(out, /\[mcp_servers\.idra_photo_extra\]\nkeep = true/);
  assert.match(out, /^\[a\]\nx = 1/);
});

test('the checkout launcher starts the bundled server and runs a batch, with the workspace passed by env', async () => {
  const bundle = path.join(REPO_ROOT, 'idra-photo.mjs');
  assert.ok(fs.existsSync(bundle), 'run npm run bundle first');
  const ws = tmpWorkspace();
  const launch =
    process.platform === 'win32'
      ? { command: path.join(REPO_ROOT, 'idra-photo.cmd'), args: ['serve'] }
      : { command: '/bin/sh', args: [path.join(REPO_ROOT, 'idra-photo.sh'), 'serve'] };
  const r = await runSimulatedBatch({ cliPath: bundle, workspace: ws, count: 4, launch: { ...launch, env: { IDRA_WORKSPACE: ws } } });
  assert.equal(r.final.status, 'done');
  assert.equal(r.final.progress, '4/4');
  assert.equal(fs.readdirSync(path.join(ws, 'outputs')).length, 1);
});

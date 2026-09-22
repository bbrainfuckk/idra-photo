import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createBatch, extendBatch, status } from '../../src/core/queue.js';
import { closeWorkspace } from '../../src/core/workspace.js';
import { buildManifest } from '../../src/core/manifest.js';
import { MIGRATIONS } from '../../src/storage/migrations.js';
import { claim, complete, expectCode, gen, key, open, refPng, tmpWorkspace } from '../helpers.js';

function counterpartBatch(ws: string) {
  const ctx = open(ws);
  const lich = refPng(ws, 'lich.png', 1);
  const banshee = refPng(ws, 'banshee.png', 2);
  const shared = refPng(ws, 'set-look.png', 3);
  const r = createBatch(ctx, {
    idempotency_key: key(),
    request: 'Opposite-gender counterpart for each character',
    count: 2,
    planning_mode: 'diversified',
    references: [{ path: shared, role: 'style', label: 'set look' }],
    constraints: { style: 'strict' },
    concepts: [
      { text: 'Female counterpart of the Lich', references: [{ path: lich, role: 'design', label: 'lich' }] },
      { text: 'Male counterpart of the Banshee', references: [{ path: banshee, role: 'design', label: 'banshee' }] },
    ],
  });
  return { ctx, id: r['batch_id'] as string, r };
}

test('each image gets its own design reference plus the shared ones, and nothing else', () => {
  const { ctx, id, r } = counterpartBatch(tmpWorkspace());
  assert.equal(r['per_image_references'], 2);
  const j1 = claim(ctx, id);
  assert.deepEqual(
    j1.references.map((x) => `${x.label}:${x.role}`),
    ['set look:style', 'lich:design'],
  );
  assert.match(j1.prompt, /Reference "lich": the design to adapt/);
  assert.doesNotMatch(j1.prompt, /banshee/i);
  gen(j1);
  const j2 = complete(ctx, id, j1).job!;
  assert.deepEqual(
    j2.references.map((x) => `${x.label}:${x.role}`),
    ['set look:style', 'banshee:design'],
  );
  assert.match(j2.prompt, /Male counterpart of the Banshee/);
  assert.doesNotMatch(j2.prompt, /lich/i);
  assert.ok(j2.references[1]!.path.includes(`${path.sep}j002${path.sep}`), 'per-image copies live in their own folder');
  const m = buildManifest(ctx, id)!;
  const refs = m['references'] as { label: string; for_job: number | string }[];
  assert.deepEqual(
    refs.map((x) => `${x.label}:${x.for_job}`).sort(),
    ['banshee:2', 'lich:1', 'set look:all'],
  );
  assert.match(String(status(ctx, { batch_id: id })['card']), /\+ 2 per-image/);
  closeWorkspace(ctx);
});

test('extensions accept per-image references and keep numbering', () => {
  const ws = tmpWorkspace();
  const { ctx, id } = counterpartBatch(ws);
  const wraith = refPng(ws, 'wraith.png', 4);
  const k = key();
  const out = extendBatch(ctx, { batch_id: id, idempotency_key: k, count: 1, concepts: [{ text: 'Female counterpart of the Wraith', references: [{ path: wraith, role: 'design' }] }] });
  assert.equal(out['seqs'], '3-3');
  assert.equal(extendBatch(ctx, { batch_id: id, idempotency_key: k, count: 1, concepts: [{ text: 'Female counterpart of the Wraith', references: [{ path: wraith, role: 'design' }] }] })['replayed'], true);
  const jobs = ctx.repo.allJobs(id);
  assert.equal(jobs.length, 3);
  assert.deepEqual(
    ctx.repo.refsForJob(id, jobs[2]!.id).map((r) => r.label),
    ['set look', 'wraith'],
  );
  closeWorkspace(ctx);
});

test('per-image reference limits and a missing per-image file pause only when that job is next', () => {
  const ws = tmpWorkspace();
  const ctx = open(ws);
  const p = refPng(ws, 'x.png', 9);
  const five = Array.from({ length: 5 }, () => ({ path: p, role: 'design' as const }));
  expectCode(() => createBatch(ctx, { idempotency_key: key(), request: 'r', count: 1, planning_mode: 'explicit', concepts: [{ text: 't', references: five }] }), 'INVALID_INPUT');
  closeWorkspace(ctx);
  const { ctx: c2, id } = counterpartBatch(ws);
  const job2Ref = c2.repo.listReferences(id).find((r) => r.label === 'banshee')!;
  fs.rmSync(job2Ref.stored_path);
  const j1 = claim(c2, id);
  gen(j1);
  const r = complete(c2, id, j1);
  assert.equal(r.status, 'paused');
  assert.equal(r.reason, 'reference_missing');
  closeWorkspace(c2);
});

test('upgrading a schema-1 database keeps existing references as batch-wide', () => {
  const ws = tmpWorkspace();
  fs.mkdirSync(path.join(ws, '.idra'), { recursive: true });
  const raw = new DatabaseSync(path.join(ws, '.idra', 'state.sqlite'));
  raw.exec(MIGRATIONS[0]!.sql);
  raw.exec("INSERT INTO meta(key, value) VALUES ('schema_version', '1')");
  const now = new Date().toISOString();
  raw
    .prepare(
      `INSERT INTO batches (id, slug, idempotency_key, created_at, updated_at, request_text, planning_mode, base_prompt, requested_count, constraints_json, target_aspect, status, paused, pause_reason, output_dir, max_retries, simulated)
       VALUES ('b_old', 'old', 'k-old', ?, ?, 'r', 'variations', 'p', 0, '{}', NULL, 'active', 0, NULL, ?, 2, 0)`,
    )
    .run(now, now, path.join(ws, 'outputs', 'old'));
  raw
    .prepare(
      `INSERT INTO batch_references (id, batch_id, role, label, original_path, stored_path, sha256, bytes, width, height, format, created_at)
       VALUES ('ref_old', 'b_old', 'style', 'old look', 'o', 's', 'h', 1, 20, 20, 'png', ?)`,
    )
    .run(now);
  raw.close();
  const ctx = open(ws);
  assert.equal(ctx.db.schemaVersion(), 2);
  const refs = ctx.repo.listReferences('b_old');
  assert.equal(refs.length, 1);
  assert.equal(refs[0]!.job_id, null);
  assert.equal(ctx.repo.getBatch('b_old')!.variety, 'balanced');
  closeWorkspace(ctx);
});

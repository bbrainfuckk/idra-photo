import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBatch, controlBatch, extendBatch, reconcile, reportProblem, status, step } from '../../src/core/queue.js';
import { closeWorkspace } from '../../src/core/workspace.js';
import { buildManifest } from '../../src/core/manifest.js';
import { makeJpegContainer, makePng } from '../../src/sim/fixtures.js';
import { sha256Hex } from '../../src/core/ids.js';
import { claim, complete, create, expectCode, gen, key, open, outputFiles, refPng, tmpWorkspace } from '../helpers.js';

function sumCounts(c: Record<string, number | undefined>): number {
  return ['completed', 'pending', 'cooling', 'claimed', 'failed', 'uncertain', 'cancelled'].reduce((s, k) => s + (c[k] ?? 0), 0);
}

test('create is idempotent and conflicting reuse of a key is refused', () => {
  const ctx = open(tmpWorkspace());
  const input = { idempotency_key: 'same', request: 'r', count: 3, base_prompt: 'p' };
  const a = createBatch(ctx, input);
  const b = createBatch(ctx, input);
  assert.equal(a['batch_id'], b['batch_id']);
  assert.equal(b['replayed'], true);
  assert.equal(ctx.repo.listBatches().length, 1);
  expectCode(() => createBatch(ctx, { ...input, count: 4 }), 'IDEMPOTENCY_CONFLICT');
  closeWorkspace(ctx);
});

test('one job at a time: a second step without completion does not claim another job', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 3);
  const j1 = claim(ctx, id);
  assert.equal(j1.seq, 1);
  const again = step(ctx, { batch_id: id });
  assert.equal(again.status, 'blocked');
  assert.equal(again.reason, 'job_in_progress');
  assert.equal(again.job, undefined);
  assert.equal(ctx.repo.counts(id, new Date().toISOString()).claimed, 1);
  closeWorkspace(ctx);
});

test('combined step: completion saves the image and returns the next job; counts always sum to total', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 3);
  let job = claim(ctx, id);
  const seen: number[] = [];
  for (;;) {
    gen(job);
    const r = complete(ctx, id, job);
    assert.equal(sumCounts(r.counts as Record<string, number>), 3);
    seen.push(r.saved!.seq);
    if (r.status !== 'job') {
      assert.equal(r.status, 'done');
      break;
    }
    job = r.job!;
  }
  assert.deepEqual(seen, [1, 2, 3]);
  assert.deepEqual(outputFiles(ctx, id).sort(), ['001-a-bottle-on-marble.png', '002-a-bottle-on-marble.png', '003-a-bottle-on-marble.png']);
  closeWorkspace(ctx);
});

test('repeating the same completion is a replay: no extra file, no double count, no second claim', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 3);
  const j1 = claim(ctx, id);
  gen(j1);
  const r1 = complete(ctx, id, j1);
  const r2 = complete(ctx, id, j1);
  assert.equal(r2.replayed, true);
  assert.equal(r2.job?.job_id, r1.job?.job_id);
  assert.equal(r2.job?.attempt_token, r1.job?.attempt_token);
  const c = ctx.repo.counts(id, new Date().toISOString());
  assert.equal(c.completed, 1);
  assert.equal(c.claimed, 1);
  assert.equal(outputFiles(ctx, id).length, 1);
  closeWorkspace(ctx);
});

test('a different artifact for an already-completed job is refused, never replaces it', () => {
  const ws = tmpWorkspace();
  const ctx = open(ws);
  const id = create(ctx, 2);
  const j1 = claim(ctx, id);
  gen(j1);
  complete(ctx, id, j1);
  const other = path.join(ws, 'other.png');
  fs.writeFileSync(other, makePng(64, 80, 999));
  expectCode(() => complete(ctx, id, j1, other), 'ARTIFACT_CONFLICT');
  closeWorkspace(ctx);
});

test('invalid or missing output never dispatches another job', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 3);
  const j1 = claim(ctx, id);
  expectCode(() => complete(ctx, id, j1), 'ARTIFACT_INVALID');
  fs.writeFileSync(j1.save_to, 'corrupt bytes, not an image');
  expectCode(() => complete(ctx, id, j1), 'ARTIFACT_INVALID');
  const c = ctx.repo.counts(id, new Date().toISOString());
  assert.deepEqual([c.claimed, c.pending, c.completed], [1, 2, 0]);
  gen(j1);
  assert.equal(complete(ctx, id, j1).status, 'job');
  closeWorkspace(ctx);
});

test('stale and foreign attempt tokens are rejected', () => {
  const ctx = open(tmpWorkspace());
  const a = create(ctx, 2);
  const b = create(ctx, 2);
  const ja = claim(ctx, a);
  const jb = claim(ctx, b);
  expectCode(() => step(ctx, { batch_id: a, completed: { job_id: ja.job_id, attempt_token: jb.attempt_token } }), 'ATTEMPT_TOKEN_MISMATCH');
  expectCode(() => step(ctx, { batch_id: a, completed: { job_id: ja.job_id, attempt_token: 'f'.repeat(32) } }), 'ATTEMPT_NOT_FOUND');
  // Supersede the attempt, then the old token must not complete anything.
  controlBatch(ctx, a, 'pause');
  reconcile(ctx, { batch_id: a, job_id: ja.job_id, action: 'authorize_retry', note: 'test' });
  gen(ja);
  expectCode(() => complete(ctx, a, ja), 'ATTEMPT_ALREADY_RESOLVED');
  closeWorkspace(ctx);
});

test('JPEG bytes saved as image.png are finalized with a .jpg extension', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 1);
  const j = claim(ctx, id);
  fs.writeFileSync(j.save_to, makeJpegContainer(64, 80));
  const r = complete(ctx, id, j);
  assert.match(r.saved!.file, /\.jpg$/);
  const att = ctx.db.get<{ evidence_json: string }>('SELECT evidence_json FROM attempts WHERE token = ?', [j.attempt_token])!;
  assert.equal(JSON.parse(att.evidence_json).extension_mismatch, true);
  closeWorkspace(ctx);
});

test('identical files across jobs and copies of references are flagged, not counted', () => {
  const ws = tmpWorkspace();
  const ctx = open(ws);
  const ref = refPng(ws, 'style.png', 5);
  const id = create(ctx, 3, { references: [{ path: ref, role: 'style' }], constraints: { style: 'strict' } });
  const j1 = claim(ctx, id);
  gen(j1, 100);
  const r = complete(ctx, id, j1);
  const j2 = r.job!;
  gen(j2, 100);
  expectCode(() => complete(ctx, id, j2), 'ARTIFACT_CONFLICT');
  fs.copyFileSync(ref, j2.save_to);
  expectCode(() => complete(ctx, id, j2), 'ARTIFACT_CONFLICT');
  assert.equal(ctx.repo.counts(id, new Date().toISOString()).completed, 1);
  assert.equal(ctx.repo.countEvents('duplicate_artifact'), 1);
  assert.equal(ctx.repo.countEvents('artifact_equals_reference'), 1);
  closeWorkspace(ctx);
});

test('transient failures retry with a persisted cooldown, then fail; retry_failed re-queues', () => {
  const ctx = open(tmpWorkspace(), { limits: { backoffSeconds: [0, 0], maxRetries: 2, maxReferences: 8, image: { maxBytes: 1e8, maxSide: 8192, maxPixels: 1e8, minSide: 16 } } });
  const id = create(ctx, 1);
  for (let i = 0; i < 3; i++) {
    const j = claim(ctx, id);
    const r = reportProblem(ctx, { batch_id: id, job_id: j.job_id, attempt_token: j.attempt_token, classification: 'transient', message: 'timeout' });
    assert.equal(r.status, 'blocked');
  }
  const done = step(ctx, { batch_id: id });
  assert.equal(done.status, 'exhausted_with_errors');
  const job = ctx.repo.allJobs(id)[0]!;
  assert.deepEqual([job.state, job.attempts_count, job.retries_used], ['failed', 3, 2]);
  controlBatch(ctx, id, 'retry_failed');
  assert.equal(step(ctx, { batch_id: id }).status, 'job');
  closeWorkspace(ctx);
});

test('cooldown is data, not a sleeping call', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 1);
  const j = claim(ctx, id);
  reportProblem(ctx, { batch_id: id, job_id: j.job_id, attempt_token: j.attempt_token, classification: 'transient', message: 'x' });
  const t0 = Date.now();
  const r = step(ctx, { batch_id: id });
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(r.reason, 'cooldown');
  assert.ok(r.retry_after);
  closeWorkspace(ctx);
});

test('usage limits pause without guessing a reset time; safety refusals are not retried', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 3);
  const j1 = claim(ctx, id);
  const r = reportProblem(ctx, { batch_id: id, job_id: j1.job_id, attempt_token: j1.attempt_token, classification: 'usage_limit', message: 'limit reached' });
  assert.equal(r.status, 'paused');
  assert.equal(r.retry_after, undefined);
  assert.equal(step(ctx, { batch_id: id }).status, 'paused');
  controlBatch(ctx, id, 'resume');
  const again = claim(ctx, id);
  assert.equal(again.seq, 1);
  const s = reportProblem(ctx, { batch_id: id, job_id: again.job_id, attempt_token: again.attempt_token, classification: 'safety_refusal', message: 'refused' });
  assert.equal(s.reason, 'safety_refusal');
  const note = controlBatch(ctx, id, 'retry_failed');
  assert.match(String(note['note']), /0 failed job\(s\) queued again; 1 not eligible/);
  const job = ctx.repo.getJob(again.job_id)!;
  assert.equal(job.state, 'failed');
  assert.equal(job.prompt, ctx.repo.getJob(again.job_id)!.prompt);
  closeWorkspace(ctx);
});

test('report_problem is idempotent per attempt', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 2);
  const j = claim(ctx, id);
  const args = { batch_id: id, job_id: j.job_id, attempt_token: j.attempt_token, classification: 'unknown' as const, message: '???' };
  reportProblem(ctx, args);
  const again = reportProblem(ctx, args);
  assert.equal(again.replayed, true);
  assert.equal(ctx.repo.countEvents('problem'), 1);
  closeWorkspace(ctx);
});

test('cancel stops dispatch; a completion racing with cancel is kept but issues no new work', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 5);
  const j1 = claim(ctx, id);
  gen(j1);
  controlBatch(ctx, id, 'cancel');
  const r = complete(ctx, id, j1);
  assert.equal(r.status, 'cancelled');
  assert.equal(r.job, undefined);
  const c = ctx.repo.counts(id, new Date().toISOString());
  assert.deepEqual([c.completed, c.cancelled, c.claimed], [1, 4, 0]);
  expectCode(() => controlBatch(ctx, id, 'resume'), 'BATCH_CANCELLED');
  expectCode(() => extendBatch(ctx, { batch_id: id, idempotency_key: key(), count: 1 }), 'BATCH_CANCELLED');
  closeWorkspace(ctx);
});

test('pause lets the running job finish but hands out nothing new', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 3);
  const j1 = claim(ctx, id);
  controlBatch(ctx, id, 'pause');
  gen(j1);
  const r = complete(ctx, id, j1);
  assert.equal(r.status, 'paused');
  assert.equal(r.saved?.seq, 1);
  controlBatch(ctx, id, 'resume');
  assert.equal(claim(ctx, id).seq, 2);
  closeWorkspace(ctx);
});

test('extend appends with continued numbering and is idempotent', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 2);
  const j1 = claim(ctx, id);
  gen(j1);
  complete(ctx, id, j1);
  const k = key();
  const a = extendBatch(ctx, { batch_id: id, idempotency_key: k, count: 3 });
  const b = extendBatch(ctx, { batch_id: id, idempotency_key: k, count: 3 });
  assert.equal(a['seqs'], '3-5');
  assert.equal(b['replayed'], true);
  assert.equal(ctx.repo.allJobs(id).length, 5);
  assert.equal(ctx.repo.getBatch(id)!.requested_count, 5);
  expectCode(() => extendBatch(ctx, { batch_id: id, idempotency_key: k, count: 4 }), 'IDEMPOTENCY_CONFLICT');
  assert.equal(ctx.repo.counts(id, new Date().toISOString()).completed, 1);
  closeWorkspace(ctx);
});

test('image 37 finished but the session closed before reporting: adopted from staging, not regenerated', () => {
  const ws = tmpWorkspace();
  let ctx = open(ws);
  const id = create(ctx, 40);
  let job = claim(ctx, id);
  while (job.seq < 37) {
    gen(job);
    job = complete(ctx, id, job).job!;
  }
  gen(job); // image 37 exists in staging, never reported
  closeWorkspace(ctx);

  ctx = open(ws); // new session
  const blocked = step(ctx, { batch_id: id });
  assert.equal(blocked.reason, 'job_in_progress');
  assert.equal(blocked.detail?.['seq'], 37);
  const r = reconcile(ctx, { batch_id: id, job_id: job.job_id, action: 'check' });
  assert.equal(r['state'], 'completed');
  const next = claim(ctx, id);
  assert.equal(next.seq, 38);
  const claims37 = ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM attempts WHERE job_id = ?", [job.job_id])!;
  assert.equal(Number(claims37.n), 1);
  closeWorkspace(ctx);
});

test('abandoned claim with nothing in staging becomes uncertain and pauses; retry needs an explicit decision', () => {
  const ws = tmpWorkspace();
  let ctx = open(ws);
  const id = create(ctx, 3);
  const j1 = claim(ctx, id);
  closeWorkspace(ctx);
  ctx = open(ws, { staleClaimMinutes: 0 });
  await_(10);
  const r = step(ctx, { batch_id: id });
  assert.equal(r.reason, 'uncertain_needs_reconcile');
  assert.equal(ctx.repo.getBatch(id)!.pause_reason, 'uncertain');
  const chk = reconcile(ctx, { batch_id: id, job_id: j1.job_id, action: 'check' });
  assert.equal(chk['state'], 'uncertain');
  assert.equal(step(ctx, { batch_id: id }).status, 'paused');
  reconcile(ctx, { batch_id: id, job_id: j1.job_id, action: 'authorize_retry', note: 'user said regenerate' });
  const again = claim(ctx, id);
  assert.equal(again.seq, 1);
  assert.notEqual(again.attempt_token, j1.attempt_token);
  assert.match(again.save_to, /001-a2/);
  closeWorkspace(ctx);
});

test('a late artifact for an uncertain attempt is still accepted with its original token', () => {
  const ws = tmpWorkspace();
  const ctx = open(ws, { staleClaimMinutes: 0 });
  const id = create(ctx, 2);
  const j1 = claim(ctx, id);
  await_(10);
  step(ctx, { batch_id: id }); // marks j1 uncertain
  gen(j1);
  const r = complete(ctx, id, j1);
  assert.equal(r.saved?.seq, 1);
  assert.equal(r.status, 'job');
  closeWorkspace(ctx);
});

function await_(ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    /* spin briefly so claimed_at is strictly in the past */
  }
}

for (const point of ['before_finalize', 'after_finalize', 'before_commit', 'after_commit']) {
  test(`crash at ${point}: retrying yields exactly one output and one completion`, () => {
    const ws = tmpWorkspace();
    const faults = new Set([point]);
    let ctx = open(ws, { faults });
    const id = create(ctx, 3);
    const j1 = claim(ctx, id);
    gen(j1);
    expectCode(() => complete(ctx, id, j1), 'INTERNAL');
    closeWorkspace(ctx);
    ctx = open(ws);
    const r = complete(ctx, id, j1);
    assert.equal(r.saved?.seq, 1);
    assert.equal(r.status, 'job');
    const c = ctx.repo.counts(id, new Date().toISOString());
    assert.deepEqual([c.completed, c.claimed, c.pending], [1, 1, 1]);
    assert.equal(outputFiles(ctx, id).length, 1);
    closeWorkspace(ctx);
  });
}

test('an unrecorded leftover at the final path is moved aside, never overwritten', () => {
  const ws = tmpWorkspace();
  const ctx = open(ws);
  const id = create(ctx, 1);
  const j = claim(ctx, id);
  const out = ctx.repo.getBatch(id)!.output_dir;
  fs.mkdirSync(out, { recursive: true });
  const leftover = makePng(64, 80, 4242);
  fs.writeFileSync(path.join(out, '001-a-bottle-on-marble.png'), leftover);
  gen(j);
  complete(ctx, id, j);
  const orphans = fs.readdirSync(path.join(ws, '.idra', 'orphans'));
  assert.equal(orphans.length, 1);
  assert.equal(sha256Hex(fs.readFileSync(path.join(ws, '.idra', 'orphans', orphans[0]!))), sha256Hex(leftover));
  closeWorkspace(ctx);
});

test('path security: outside files, traversal, relative paths, other attempts, and symlink escapes are refused', () => {
  const ws = tmpWorkspace();
  const outside = tmpWorkspace('idra-outside-');
  const ctx = open(ws);
  const id = create(ctx, 3);
  const j1 = claim(ctx, id);
  const foreign = path.join(outside, 'x.png');
  fs.writeFileSync(foreign, makePng(64, 80, 1));
  expectCode(() => complete(ctx, id, j1, foreign), 'PATH_OUTSIDE_WORKSPACE');
  expectCode(() => complete(ctx, id, j1, path.join(ws, '..', path.basename(outside), 'x.png')), 'PATH_OUTSIDE_WORKSPACE');
  expectCode(() => complete(ctx, id, j1, 'relative/x.png'), 'PATH_UNSAFE');
  expectCode(() => complete(ctx, id, j1, path.join(ws, 'ab.png')), 'PATH_UNSAFE');
  expectCode(() => createBatch(ctx, { idempotency_key: key(), request: 'r', count: 1, base_prompt: 'p', references: [{ path: foreign, role: 'style' }] }), 'REFERENCE_INVALID');
  const link = path.join(ws, 'link.png');
  let linked = false;
  try {
    fs.symlinkSync(foreign, link);
    linked = true;
  } catch {
    /* symlinks need privileges on Windows; covered on POSIX CI */
  }
  if (linked) expectCode(() => complete(ctx, id, j1, link), 'PATH_OUTSIDE_WORKSPACE');
  expectCode(() => open(os.homedir()), 'PATH_UNSAFE');
  closeWorkspace(ctx);
});

test('artifacts may be imported from an authorized folder and are copied into staging first', () => {
  const ws = tmpWorkspace();
  const gallery = tmpWorkspace('idra-gen-');
  const ctx = open(ws, { allowImports: [gallery] });
  const id = create(ctx, 2);
  const j1 = claim(ctx, id);
  const produced = path.join(gallery, 'exec-123.png');
  fs.writeFileSync(produced, makePng(64, 80, 77));
  const r = complete(ctx, id, j1, produced);
  assert.equal(r.saved?.seq, 1);
  assert.ok(fs.existsSync(path.join(path.dirname(j1.save_to), 'imported.png')));
  assert.ok(fs.existsSync(produced), 'the original is never moved or deleted');
  closeWorkspace(ctx);
});

test('a missing reference pauses the batch instead of generating without it', () => {
  const ws = tmpWorkspace();
  const ctx = open(ws);
  const ref = refPng(ws, 'product.png', 9);
  const id = create(ctx, 2, { references: [{ path: ref, role: 'product' }] });
  const j1 = claim(ctx, id);
  assert.equal(j1.references[0]!.role, 'product');
  assert.ok(j1.references[0]!.path.includes(path.join('.idra', 'references')));
  gen(j1);
  fs.rmSync(j1.references[0]!.path);
  const r = complete(ctx, id, j1);
  assert.equal(r.status, 'paused');
  assert.equal(r.reason, 'reference_missing');
  closeWorkspace(ctx);
});

test('style constraint without a style reference or description is refused', () => {
  const ctx = open(tmpWorkspace());
  expectCode(() => create(ctx, 1, { constraints: { style: 'strict' } }), 'CONSTRAINT_CONFLICT');
  closeWorkspace(ctx);
});

test('status is compact by default and paginates details on request', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 30);
  const s = status(ctx, { batch_id: id });
  assert.equal(s['jobs'], undefined);
  assert.ok(String(s['card']).length <= 600);
  const d = status(ctx, { batch_id: id, detail: true, limit: 10 });
  assert.equal((d['jobs'] as unknown[]).length, 10);
  assert.equal(d['next_offset'], 10);
  assert.equal((status(ctx, {})['batches'] as unknown[]).length, 1);
  closeWorkspace(ctx);
});

test('manifest records counts, hashes, and requested vs actual aspect', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 2, { target_aspect: '1:1' });
  const j1 = claim(ctx, id);
  gen(j1);
  complete(ctx, id, j1);
  const m = buildManifest(ctx, id)!;
  const jobs = m['jobs'] as { artifact: { sha256: string; requested_aspect: string; actual_aspect: string; aspect_matches: boolean } | null; visual_review: { performed: boolean } }[];
  assert.equal(jobs[0]!.artifact!.sha256, sha256Hex(fs.readFileSync(j1.save_to)));
  assert.equal(jobs[0]!.artifact!.requested_aspect, '1:1');
  assert.equal(jobs[0]!.artifact!.actual_aspect, '4:5');
  assert.equal(jobs[0]!.artifact!.aspect_matches, false);
  assert.equal(jobs[0]!.visual_review.performed, false);
  assert.equal(jobs[1]!.artifact, null);
  const file = path.join(ctx.repo.getBatch(id)!.output_dir, 'manifest.json');
  assert.ok(fs.existsSync(file));
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /attempt_token/);
  assert.ok(!text.includes(j1.attempt_token), 'attempt tokens are never exported');
  closeWorkspace(ctx);
});

test('migrations apply once and state survives reopening', () => {
  const ws = tmpWorkspace();
  let ctx = open(ws);
  assert.equal(ctx.db.schemaVersion(), 1);
  const id = create(ctx, 2);
  closeWorkspace(ctx);
  ctx = open(ws);
  assert.equal(ctx.db.schemaVersion(), 1);
  assert.deepEqual(ctx.db.migrate().applied, []);
  assert.equal(ctx.repo.allJobs(id).length, 2);
  closeWorkspace(ctx);
});

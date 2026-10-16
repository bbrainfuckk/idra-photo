import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBatch, extendBatch, reconcile, status, step, type JobPayload } from '../../src/core/queue.js';
import { normalizeConsistency, type VisualReview } from '../../src/core/consistency.js';
import { normalizeConstraints } from '../../src/core/constraints.js';
import { buildManifest } from '../../src/core/manifest.js';
import { sha256Hex } from '../../src/core/ids.js';
import { closeWorkspace } from '../../src/core/workspace.js';
import { claim, create, expectCode, gen, key, open, outputFiles, tmpWorkspace } from '../helpers.js';

const contract = {
  name: 'Warm editorial campaign',
  rules: [
    { id: 'palette', instruction: 'Cream #F4EFE6 background; charcoal #252525 type; no additional accent colors.' },
    { id: 'lighting', instruction: 'Soft window light from the left; warm neutral grading; no neon.' },
  ],
  allowed_changes: ['pose'],
};

// Fixtures exercise queue enforcement only. These observations are synthetic, not a real visual review.
function review(job: JobPayload): VisualReview {
  return {
    performed: true, passed: true,
    contract_hash: job.consistency!.contract_hash,
    artifact_sha256: sha256Hex(fs.readFileSync(job.save_to)),
    checks: job.consistency!.rules.map((r) => ({ rule_id: r.id, passed: true, observed: `SIMULATED observation for ${r.id}` })),
  };
}

test('strict acceptance refuses absent, incomplete, duplicate, stale, and wrong-file evidence before saving', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 2, { consistency: contract, constraints: { style: 'strict' } });
  const job = claim(ctx, id);
  gen(job);
  const valid = review(job);
  const submit = (r?: VisualReview) => step(ctx, { batch_id: id, completed: { job_id: job.job_id, attempt_token: job.attempt_token, review: r } });
  for (const invalid of [
    undefined, { performed: false }, { performed: true, passed: true },
    { ...valid, contract_hash: '0'.repeat(64) },
    { ...valid, artifact_sha256: '0'.repeat(64) },
    { ...valid, checks: valid.checks!.slice(1) },
    { ...valid, checks: valid.checks!.map(() => valid.checks![0]!) },
    { ...valid, checks: valid.checks!.map((c) => ({ ...c, observed: ' ' })) },
    { ...valid, checks: [...valid.checks!, { rule_id: 'unknown', passed: true, observed: 'unknown' }] },
  ]) expectCode(() => submit(invalid), 'REVIEW_REQUIRED');
  assert.equal(ctx.repo.counts(id, new Date().toISOString()).completed, 0);
  assert.deepEqual(outputFiles(ctx, id), []);
  const next = submit(valid);
  assert.equal(next.status, 'job');
  assert.ok(next.job!.references.some((r) => r.role === 'style' && r.path.endsWith('.png')));
  assert.match(next.job!.prompt, /first reviewed batch image/);
  assert.equal(next.job!.consistency!.contract_hash, job.consistency!.contract_hash);
  closeWorkspace(ctx);
});

test('failed checks reject pixels despite passed=true; retries carry corrections, preserve evidence, and stop at budget', () => {
  const ctx = open(tmpWorkspace(), { limits: { backoffSeconds: [0] } });
  const id = create(ctx, 1, { consistency: contract, max_retries: 1 });
  const first = claim(ctx, id);
  gen(first);
  const r = review(first);
  r.checks![0] = { rule_id: 'palette', passed: false, observed: 'Background is neon blue instead of the specified cream; restore cream.' };
  const args = { batch_id: id, completed: { job_id: first.job_id, attempt_token: first.attempt_token, review: r } };
  const rejected = step(ctx, args);
  assert.equal(rejected.reason, 'invalid_output');
  assert.equal(step(ctx, args).replayed, true);
  assert.equal(ctx.repo.getJob(first.job_id)!.retries_used, 1);
  assert.deepEqual(outputFiles(ctx, id), []);
  const retry = claim(ctx, id);
  assert.match(retry.prompt, /restore cream/);
  fs.copyFileSync(first.save_to, retry.save_to);
  const exhausted = step(ctx, { batch_id: id, completed: { job_id: retry.job_id, attempt_token: retry.attempt_token, review: review(retry) } });
  assert.equal(exhausted.reason, 'invalid_output');
  assert.equal(step(ctx, { batch_id: id }).status, 'exhausted_with_errors');
  assert.equal(ctx.repo.counts(id, new Date().toISOString()).completed, 0);
  const manifest = buildManifest(ctx, id)!;
  const jobs = manifest['jobs'] as { rejected_attempts: unknown[] }[];
  assert.equal(jobs[0]!.rejected_attempts.length, 2);
  closeWorkspace(ctx);
});

test('a corrected result can pass after a rejected result without weakening the contract', () => {
  const ctx = open(tmpWorkspace(), { limits: { backoffSeconds: [0] } });
  const id = create(ctx, 1, { consistency: contract });
  const first = claim(ctx, id);
  gen(first);
  step(ctx, { batch_id: id, completed: { job_id: first.job_id, attempt_token: first.attempt_token, review: { ...review(first), passed: false, notes: 'Correct the light.' } } });
  const second = claim(ctx, id);
  gen(second, 123456);
  assert.equal(step(ctx, { batch_id: id, completed: { job_id: second.job_id, attempt_token: second.attempt_token, review: review(second) } }).status, 'done');
  assert.equal(outputFiles(ctx, id).length, 1);
  closeWorkspace(ctx);
});

test('rejected bytes cannot be passed off as a different job in the same batch', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 2, { consistency: contract, max_retries: 0 });
  const first = claim(ctx, id);
  gen(first);
  step(ctx, { batch_id: id, completed: { job_id: first.job_id, attempt_token: first.attempt_token, review: { ...review(first), passed: false } } });
  const second = claim(ctx, id);
  fs.copyFileSync(first.save_to, second.save_to);
  const result = step(ctx, { batch_id: id, completed: { job_id: second.job_id, attempt_token: second.attempt_token, review: review(second) } });
  assert.equal(result.reason, 'invalid_output');
  assert.deepEqual(outputFiles(ctx, id), []);
  closeWorkspace(ctx);
});

test('wrong aspect is rejected deterministically even when the host passes every visual check', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 1, { consistency: contract, target_aspect: '1:1', max_retries: 0 });
  const job = claim(ctx, id);
  gen(job); // 4:5
  const result = step(ctx, { batch_id: id, completed: { job_id: job.job_id, attempt_token: job.attempt_token, review: review(job) } });
  assert.equal(result.reason, 'invalid_output');
  assert.deepEqual(outputFiles(ctx, id), []);
  closeWorkspace(ctx);
});

test('both recovery paths require the same review; duplicate permission does not waive it', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 1, { consistency: contract });
  const job = claim(ctx, id);
  gen(job);
  for (const action of ['check', 'adopt'] as const) {
    expectCode(() => reconcile(ctx, { batch_id: id, job_id: job.job_id, action, artifact_path: job.save_to, accept_duplicate: true }), 'REVIEW_REQUIRED');
  }
  assert.equal(reconcile(ctx, { batch_id: id, job_id: job.job_id, action: 'check', review: review(job) })['state'], 'completed');
  closeWorkspace(ctx);
});

test('contract persists through reopen and extension; automatic variety obeys allowed_changes', () => {
  const ws = tmpWorkspace();
  let ctx = open(ws);
  const id = create(ctx, 2, { consistency: contract, variety: 'bold' });
  const before = status(ctx, { batch_id: id })['consistency'];
  closeWorkspace(ctx);
  ctx = open(ws);
  extendBatch(ctx, { batch_id: id, idempotency_key: key(), count: 2 });
  assert.deepEqual(status(ctx, { batch_id: id })['consistency'], before);
  for (const job of ctx.repo.allJobs(id)) {
    assert.match(job.prompt, /LOCKED DESIGN CONTRACT/);
    assert.doesNotMatch(job.concept, /camera angle|framing|afternoon light|setting|background/);
  }
  closeWorkspace(ctx);
});

test('missing or modified accepted anchor pauses generation instead of silently dropping it', () => {
  const ctx = open(tmpWorkspace());
  const id = create(ctx, 1, { consistency: contract });
  const job = claim(ctx, id);
  gen(job);
  step(ctx, { batch_id: id, completed: { job_id: job.job_id, attempt_token: job.attempt_token, review: review(job) } });
  extendBatch(ctx, { batch_id: id, idempotency_key: key(), count: 1 });
  const anchor = ctx.repo.listArtifacts(id)[0]!;
  fs.renameSync(anchor.final_path, path.join(path.dirname(anchor.final_path), 'removed.png'));
  const result = step(ctx, { batch_id: id });
  assert.equal(result.status, 'paused');
  assert.equal(result.reason, 'consistency_anchor_missing');
  closeWorkspace(ctx);
});

test('contracts reject ambiguous ids, empty instructions, unknown axes, and conflicts', () => {
  const ctx = open(tmpWorkspace());
  for (const c of [
    { ...contract, rules: [] },
    { ...contract, rules: [contract.rules[0], contract.rules[0]] },
    { ...contract, rules: [{ id: 'constraint.style', instruction: 'reserved' }] },
    { ...contract, rules: [{ id: 'empty', instruction: ' ' }] },
    { ...contract, allowed_changes: ['unknown'] },
    { ...contract, extra: true },
  ]) expectCode(() => create(ctx, 1, { consistency: c }), 'INVALID_INPUT');
  expectCode(() => normalizeConsistency({ ...contract, allowed_changes: ['lighting'] }, normalizeConstraints({ style: 'strict' })), 'CONSTRAINT_CONFLICT');
  expectCode(() => createBatch(ctx, { idempotency_key: key(), request: 'test', count: 1, base_prompt: 'test', consistency: { ...contract, allowed_changes: ['framing'] }, constraints: { composition: 'high' } }), 'CONSTRAINT_CONFLICT');
  closeWorkspace(ctx);
});

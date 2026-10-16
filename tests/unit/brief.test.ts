import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designBrief } from '../../src/core/brief.js';
import { createBatch, step, type CreateBatchInput } from '../../src/core/queue.js';
import { closeWorkspace } from '../../src/core/workspace.js';
import { expectCode, open, tmpWorkspace } from '../helpers.js';

test('a short beginner prompt prepares a strict, runnable request without asking for JSON', () => {
  const ctx = open(tmpWorkspace());
  const prepared = designBrief({ request: 'Make 2 skincare photos.' });
  const input = prepared['create_batch'] as unknown as CreateBatchInput;
  assert.equal(input.count, 2);
  assert.equal(input.request, 'Make 2 skincare photos.');
  assert.equal(input.target_aspect, '1:1');
  assert.deepEqual((input.consistency as { allowed_changes: string[] }).allowed_changes, ['angle']);
  assert.ok((prepared['assumptions'] as string[]).length > 0);
  assert.equal(ctx.repo.listBatches().length, 0, 'brief creation generates nothing and writes no batch');
  const created = createBatch(ctx, input);
  const result = step(ctx, { batch_id: String(created['batch_id']) });
  assert.equal(result.status, 'job');
  assert.ok(result.job!.consistency!.rules.length >= 4);
  assert.match(result.job!.prompt, /one standalone image/);
  closeWorkspace(ctx);
});

test('custom direction and requested format replace defaults without changing the user request', () => {
  const request = 'Make 2 neon blue app screens in 16:9.';
  const rules = [{ id: 'palette', instruction: 'Black background and neon blue accents; no cream.' }];
  const prepared = designBrief({ request, target_aspect: '16:9', output_type: 'ui', design_rules: rules, allowed_changes: ['subject', 'text'] });
  const input = prepared['create_batch'] as unknown as CreateBatchInput;
  assert.equal(input.request, request);
  assert.equal(input.target_aspect, '16:9');
  assert.deepEqual((input.consistency as { rules: unknown[] }).rules.slice(0, 1), rules);
  assert.ok((input.consistency as { rules: { id: string }[] }).rules.some((r) => r.id === 'brief'));
  expectCode(() => designBrief({ request: 'Make 0 photos' }), 'INVALID_INPUT');
  expectCode(() => designBrief({ request: 'Make 700 photos' }), 'INVALID_INPUT');
  expectCode(() => designBrief({ request: 'Make 1000 photos' }), 'INVALID_INPUT');
  assert.equal((designBrief({ request: 'Make 2 images in 16:9' })['create_batch'] as CreateBatchInput).target_aspect, '16:9');
});

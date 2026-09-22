import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planJobs, normalizeConcept, GENERIC_VARIATION } from '../../src/core/planning.js';
import { assemblePrompt } from '../../src/core/prompt.js';
import { constraintWarnings, normalizeConstraints } from '../../src/core/constraints.js';
import { slugify } from '../../src/core/ids.js';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return 'none';
  } catch (e) {
    return (e as { code?: string }).code;
  }
};

test('variations keep the base prompt and need no per-image concepts', () => {
  const jobs = planJobs({ mode: 'variations', count: 3, concepts: [], basePrompt: 'Serum on marble' });
  assert.equal(jobs.length, 3);
  assert.deepEqual(
    jobs.map((j) => j.seq),
    [1, 2, 3],
  );
  assert.ok(jobs.every((j) => j.concept === GENERIC_VARIATION && j.duplicateOfSeq === null));
  assert.equal(codeOf(() => planJobs({ mode: 'variations', count: 2, concepts: [], basePrompt: null })), 'PLAN_INVALID');
});

test('diversified and explicit require exactly count concepts', () => {
  assert.equal(codeOf(() => planJobs({ mode: 'diversified', count: 3, concepts: ['a', 'b'], basePrompt: null })), 'PLAN_INVALID');
  assert.equal(codeOf(() => planJobs({ mode: 'explicit', count: 1, concepts: ['   '], basePrompt: null })), 'PLAN_INVALID');
  assert.equal(codeOf(() => planJobs({ mode: 'explicit', count: 0, concepts: [], basePrompt: null })), 'PLAN_INVALID');
  assert.equal(codeOf(() => planJobs({ mode: 'explicit', count: 501, concepts: [], basePrompt: null })), 'PLAN_INVALID');
});

test('obvious duplicate concepts are flagged, including against earlier jobs', () => {
  const jobs = planJobs({ mode: 'diversified', count: 3, concepts: ['White studio', 'white  studio!', 'Window light'], basePrompt: null });
  assert.equal(jobs[1]!.duplicateOfSeq, 1);
  assert.equal(jobs[2]!.duplicateOfSeq, null);
  const more = planJobs({ mode: 'diversified', count: 1, concepts: ['WINDOW light'], basePrompt: null, startSeq: 4, existing: jobs.map((j) => ({ seq: j.seq, normalized: j.normalized })) });
  assert.equal(more[0]!.seq, 4);
  assert.equal(more[0]!.duplicateOfSeq, 3);
  assert.equal(normalizeConcept('Café  Latte!'), 'cafe latte');
});

test('explicit prompts are used verbatim; every prompt carries its own constraints', () => {
  const constraints = normalizeConstraints({ product: 'strict', text: 'strict', text_content: ['GLOW'], style: 'strict' });
  const refs = [
    { label: 'bottle', role: 'product' },
    { label: 'look', role: 'style' },
  ];
  const p = assemblePrompt({ mode: 'explicit', concept: 'Exact prompt, do not touch.', basePrompt: null, constraints, references: refs, targetAspect: '4:5' });
  assert.ok(p.startsWith('Exact prompt, do not touch.'));
  assert.match(p, /PRODUCT \(strict\).*"bottle"/);
  assert.match(p, /TEXT \(strict\).*"GLOW"/);
  assert.match(p, /STYLE \(strict\).*"look"/);
  assert.match(p, /Target aspect ratio 4:5/);
  const v = assemblePrompt({ mode: 'variations', concept: GENERIC_VARIATION, basePrompt: 'Serum on marble', constraints, references: refs, targetAspect: null });
  assert.ok(v.startsWith('Serum on marble'));
  assert.doesNotMatch(v, /same as above/i);
});

test('constraint conflicts are reported, not silently dropped', () => {
  const c = normalizeConstraints({ composition: 'strict' });
  assert.equal(constraintWarnings(c, 'diversified')[0]?.code, 'composition_strict_limits_diversity');
  const p = assemblePrompt({ mode: 'diversified', concept: 'Beach scene', basePrompt: null, constraints: c, references: [], targetAspect: null });
  assert.match(p, /COMPOSITION \(strict\)/);
  assert.equal(codeOf(() => normalizeConstraints({ product: 'max' })), 'INVALID_INPUT');
  assert.equal(codeOf(() => normalizeConstraints({ unknown_field: 1 })), 'INVALID_INPUT');
});

test('slugs are safe and bounded', () => {
  assert.equal(slugify('../../etc/passwd'), 'etc-passwd');
  assert.equal(slugify('CON'), 'con');
  assert.equal(slugify('!!!'), 'item');
  assert.ok(slugify('x'.repeat(200)).length <= 40);
});

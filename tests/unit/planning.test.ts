import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planJobs, normalizeConcept, GENERIC_VARIATION, autoVariation, isAutoConcept } from '../../src/core/planning.js';
import { assemblePrompt, referenceLines } from '../../src/core/prompt.js';
import { constraintWarnings, normalizeConstraints, varietyLocks } from '../../src/core/constraints.js';
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
  assert.ok(jobs.every((j) => isAutoConcept(j.concept) && j.duplicateOfSeq === null));
  assert.equal(new Set(jobs.map((j) => j.concept)).size, 3, 'every image gets its own variation');
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

test('automatic variety differs per image and host hints win', () => {
  const jobs = planJobs({ mode: 'variations', count: 12, concepts: ['seated by a window, holding the bottle up'], basePrompt: 'Serum portrait' });
  assert.equal(jobs[0]!.concept, 'seated by a window, holding the bottle up');
  const auto = jobs.slice(1).map((j) => j.concept);
  assert.equal(new Set(auto).size, auto.length, 'no two automatic variations repeat within 12');
  for (let i = 1; i < jobs.length; i++) assert.notEqual(jobs[i]!.concept, jobs[i - 1]!.concept);
  const more = planJobs({ mode: 'variations', count: 2, concepts: [], basePrompt: 'Serum portrait', startSeq: 13 });
  assert.match(more[0]!.concept, /^Auto variation 13:/);
});

test('variety levels, and strict constraints lock their axes', () => {
  const open = { framing: false, light: false };
  assert.doesNotMatch(autoVariation(1, 'subtle', open), /framing|background|\blight\b/);
  assert.match(autoVariation(1, 'balanced', open), /framing/);
  assert.match(autoVariation(1, 'bold', open), /light/);
  const styleStrict = varietyLocks(normalizeConstraints({ style: 'strict', style_details: 'oil paint' }));
  assert.deepEqual(styleStrict, { framing: false, light: true });
  for (let n = 1; n <= 10; n++) assert.doesNotMatch(autoVariation(n, 'bold', styleStrict), /\blight\b|backlight/);
  const compLocked = varietyLocks(normalizeConstraints({ composition: 'high' }));
  for (let s = 1; s <= 8; s++) assert.doesNotMatch(autoVariation(s, 'bold', compLocked), /framing|camera angle|three-quarter view|profile view|eye-level view|location|take on the scene/);
});

test('a style reference lends its look only, unless the same person or product is requested too', () => {
  const [style] = referenceLines([{ label: 'painting', role: 'style' }]);
  assert.match(style!, /only for its look/);
  assert.match(style!, /Do not copy its people or faces, pose, objects, or composition or layout/);
  const withPerson = referenceLines([
    { label: 'painting', role: 'style' },
    { label: 'anna', role: 'person' },
  ]);
  assert.doesNotMatch(withPerson[0]!, /people or faces/);
  assert.match(withPerson[1]!, /the person to feature/);
  const p = assemblePrompt({
    mode: 'variations',
    concept: autoVariation(2, 'balanced', { framing: false, light: true }),
    basePrompt: 'A young woman holding a serum bottle',
    constraints: normalizeConstraints({ style: 'strict' }),
    references: [{ label: 'painting', role: 'style' }],
    targetAspect: '4:5',
  });
  assert.ok(p.startsWith('A young woman holding a serum bottle\n\nVariation for this image: '));
  assert.doesNotMatch(p, /Auto variation/);
  assert.match(p, /STYLE \(strict\).*the subject, pose, and framing come from this prompt/);
});

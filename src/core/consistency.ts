import { z } from 'zod';
import type { Constraints } from './constraints.js';
import { IdraError } from './errors.js';
import { stableHash } from './ids.js';
import { aspectMatches, type ImageInfo } from '../artifacts/validate.js';

export const variationAxis = z.enum(['subject', 'pose', 'framing', 'angle', 'background', 'lighting', 'setting', 'props', 'text']);
const rule = z.object({
  id: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_.-]*$/).refine((s) => !s.startsWith('constraint.'), 'constraint.* is reserved'),
  instruction: z.string().trim().min(1).max(600),
}).strict();

/** A batch's immutable, reusable design decisions. Nothing is inferred from a style name. */
export const consistencySchema = z.object({
  name: z.string().trim().min(1).max(80),
  rules: z.array(rule).min(1).max(20),
  allowed_changes: z.array(variationAxis).max(9).default([]),
}).strict().refine((c) => new Set(c.rules.map((r) => r.id)).size === c.rules.length, 'rule ids must be unique')
  .refine((c) => new Set(c.allowed_changes).size === c.allowed_changes.length, 'allowed_changes must be unique');

export type Consistency = z.infer<typeof consistencySchema>;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const reviewSchema = z.object({
  performed: z.boolean(),
  passed: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  contract_hash: hash.optional(),
  artifact_sha256: hash.optional(),
  checks: z.array(z.object({
    rule_id: z.string().min(1).max(80),
    passed: z.boolean(),
    observed: z.string().trim().min(1).max(500),
  }).strict()).max(25).optional(),
}).strict();
export type VisualReview = z.infer<typeof reviewSchema>;

export function normalizeConsistency(input: unknown, constraints: Constraints): Consistency | null {
  if (input === undefined || input === null) return null;
  const parsed = consistencySchema.safeParse(input);
  if (!parsed.success) throw new IdraError('INVALID_INPUT', 'consistency contract is invalid', { issues: parsed.error.issues });
  const c = parsed.data;
  const conflicts = c.allowed_changes.filter((axis) =>
    (constraints.composition !== 'off' && (axis === 'framing' || axis === 'angle')) ||
    (constraints.style === 'strict' && axis === 'lighting') ||
    (constraints.text === 'strict' && axis === 'text'));
  if (conflicts.length) throw new IdraError('CONSTRAINT_CONFLICT', 'allowed_changes contradicts locked constraints', { axes: conflicts });
  return c;
}

export function reviewSpec(c: Consistency, constraints: Constraints, aspect: string | null) {
  const strict = (['product', 'identity', 'text', 'composition', 'style'] as const)
    .filter((key) => constraints[key] === 'strict')
    .map((key) => ({ id: `constraint.${key}`, instruction: `Verify the strict ${key} requirement in this job's prompt against the supplied references and details.` }));
  return {
    contract_hash: stableHash({ consistency: c, constraints, target_aspect: aspect }),
    name: c.name,
    rules: [...c.rules, ...strict],
    allowed_changes: c.allowed_changes,
    review_required: true as const,
  };
}

export function consistencyLines(c: Consistency): string {
  return [
    `LOCKED DESIGN CONTRACT: ${c.name}`,
    ...c.rules.map((r) => `[${r.id}] ${r.instruction}`),
    `Only these dimensions may change between images: ${c.allowed_changes.join(', ') || 'none'}.`,
    'All other design decisions remain fixed. If the concept conflicts with a locked rule, resolve the conflict before generation; do not silently weaken the contract.',
  ].join('\n');
}

/** Enforces evidence coverage and file binding. Visual observations are supplied by the host, not measured by Idra. */
export function enforceConsistency(c: Consistency | null, constraints: Constraints, aspect: string | null, info: ImageInfo, input: unknown): void {
  if (!c) return;
  const spec = reviewSpec(c, constraints, aspect);
  const parsed = reviewSchema.safeParse(input);
  const r = parsed.success ? parsed.data : undefined;
  const required = spec.rules.map((rule) => rule.id);
  const checks = r?.checks ?? [];
  const ids = checks.map((check) => check.rule_id);
  if (!r?.performed || r.passed === undefined || r.contract_hash !== spec.contract_hash || r.artifact_sha256 !== info.sha256 ||
      ids.length !== required.length || new Set(ids).size !== ids.length || required.some((id) => !ids.includes(id))) {
    throw new IdraError('REVIEW_REQUIRED', 'Inspect this image and its references; submit observations for every required rule, bound to this contract and file.', {
      contract_hash: spec.contract_hash, artifact_sha256: info.sha256, required_checks: spec.rules,
      next: 'Do not regenerate or mark it passed without inspection. Submit a complete review via idra_step completed.review or idra_reconcile review.',
    });
  }
  const failures = checks.filter((check) => !check.passed).map((check) => `${check.rule_id}: ${check.observed}`);
  if (!r.passed && failures.length === 0) failures.push(r.notes?.trim() || 'The visual review did not pass; inspect and correct the result against the locked contract.');
  if (aspectMatches(aspect, info.width, info.height) === false) failures.push(`aspect: expected ${aspect}, received ${info.width}:${info.height}`);
  if (failures.length) {
    throw new IdraError('CONSISTENCY_FAILED', failures.join('; '), { artifact_sha256: info.sha256, failures, review: r });
  }
}

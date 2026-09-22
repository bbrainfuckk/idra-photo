import { IdraError } from './errors.js';

export type PlanningMode = 'diversified' | 'variations' | 'explicit';

export interface PlannedJob {
  seq: number;
  concept: string;
  normalized: string;
  duplicateOfSeq: number | null;
}

export interface PlanInput {
  mode: PlanningMode;
  count: number;
  concepts: string[];
  basePrompt: string | null;
  startSeq?: number;
  /** Already-persisted normalized concepts, used to flag duplicates across extensions. */
  existing?: { seq: number; normalized: string }[];
}

export const MAX_BATCH_COUNT = 500;

/** Concept text used for a variations job that got no per-image hint. */
export const GENERIC_VARIATION = 'Keep this exact concept; allow only natural variation in pose, angle, and small details.';
export const MAX_CONCEPT_CHARS = 2000;

/** Normalized concept text is only a cheap duplicate flag; it proves nothing about visual uniqueness. */
export function normalizeConcept(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function planJobs(input: PlanInput): PlannedJob[] {
  const { mode, count } = input;
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH_COUNT) {
    throw new IdraError('PLAN_INVALID', `count must be an integer between 1 and ${MAX_BATCH_COUNT}`, { count });
  }
  for (const [i, c] of input.concepts.entries()) {
    if (typeof c !== 'string' || c.trim().length === 0) {
      throw new IdraError('PLAN_INVALID', `concept ${i + 1} is empty`, { index: i });
    }
    if (c.length > MAX_CONCEPT_CHARS) {
      throw new IdraError('PLAN_INVALID', `concept ${i + 1} exceeds ${MAX_CONCEPT_CHARS} characters`, { index: i });
    }
  }

  let concepts: string[];
  if (mode === 'diversified' || mode === 'explicit') {
    if (input.concepts.length !== count) {
      throw new IdraError('PLAN_INVALID', `${mode} mode requires exactly count (${count}) host-authored concepts; received ${input.concepts.length}`, {
        count,
        received: input.concepts.length,
      });
    }
    concepts = input.concepts.map((c) => c.trim());
  } else {
    if (!input.basePrompt || input.basePrompt.trim().length === 0) {
      throw new IdraError('PLAN_INVALID', 'variations mode requires base_prompt');
    }
    if (input.concepts.length > count) {
      throw new IdraError('PLAN_INVALID', 'variations mode accepts at most count variation hints', { count, received: input.concepts.length });
    }
    concepts = [];
    for (let i = 0; i < count; i++) {
      const hint = input.concepts[i];
      concepts.push(hint && hint.trim().length > 0 ? hint.trim() : GENERIC_VARIATION);
    }
  }

  const startSeq = input.startSeq ?? 1;
  const seen = new Map<string, number>();
  for (const e of input.existing ?? []) {
    if (!seen.has(e.normalized)) seen.set(e.normalized, e.seq);
  }
  const jobs: PlannedJob[] = [];
  concepts.forEach((concept, i) => {
    const seq = startSeq + i;
    const normalized = normalizeConcept(concept);
    let duplicateOfSeq: number | null = null;
    if (mode !== 'variations') {
      const prior = seen.get(normalized);
      if (prior !== undefined) duplicateOfSeq = prior;
      else seen.set(normalized, seq);
    }
    jobs.push({ seq, concept, normalized, duplicateOfSeq });
  });
  return jobs;
}

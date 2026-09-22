import { IdraError } from './errors.js';

export type PlanningMode = 'diversified' | 'variations' | 'explicit';
export type Variety = 'subtle' | 'balanced' | 'bold';

export interface PlannedJob {
  seq: number;
  concept: string;
  normalized: string;
  duplicateOfSeq: number | null;
}

/** Aspects a strict or high constraint has locked, so automatic variety must not touch them. */
export interface VarietyLocks {
  framing: boolean;
  light: boolean;
}

export interface PlanInput {
  mode: PlanningMode;
  count: number;
  concepts: string[];
  basePrompt: string | null;
  startSeq?: number;
  variety?: Variety;
  locks?: VarietyLocks;
  /** Already-persisted normalized concepts, used to flag duplicates across extensions. */
  existing?: { seq: number; normalized: string }[];
}

export const MAX_BATCH_COUNT = 500;
export const MAX_CONCEPT_CHARS = 2000;

/** v0.1 text for a variations job without a hint. Kept so older batches still name files correctly. */
export const GENERIC_VARIATION = 'Keep this exact concept; allow only natural variation in pose, angle, and small details.';
export const AUTO_PREFIX = 'Auto variation';

export function isAutoConcept(concept: string): boolean {
  return concept === GENERIC_VARIATION || concept.startsWith(AUTO_PREFIX);
}

// Subject-agnostic variation axes. Each job steps through every axis, so neighbours always differ.
const FRAMING = ['close-up framing', 'medium framing from the waist up', 'wider framing that shows more of the setting', 'off-center framing with open space on one side'];
const ANGLE = ['eye-level view', 'slightly low camera angle', 'three-quarter view turned to the left', 'slightly high camera angle', 'three-quarter view turned to the right', 'near-profile view'];
const MOMENT = [
  'looking toward the viewer',
  'glancing away, lost in thought',
  'a soft, subtle smile',
  'a natural, candid mid-gesture moment',
  'head tilted slightly',
  'eyes lowered toward what they are holding',
];
const BACKGROUND = ['rearrange the background details', 'show a different part of the setting', 'add depth with a softly blurred foreground element', 'a simpler, calmer background'];
const LIGHT = ['soft morning light', 'warm late-afternoon light', 'cool overcast light', 'dramatic side light', 'gentle backlight'];
const SETTING = ['a different location that still fits the brief', 'an indoor take on the scene', 'an outdoor take on the scene'];

/**
 * Deterministic variety for a variations job the host gave no hint for. It is a prompt
 * suggestion, not a guarantee of visual difference.
 */
export function autoVariation(seq: number, variety: Variety, locks: VarietyLocks): string {
  const i = seq - 1;
  const at = <T>(arr: T[], offset = 0): T => arr[(i + offset) % arr.length]!;
  const parts: string[] = [];
  if (variety !== 'subtle' && !locks.framing) parts.push(at(FRAMING));
  if (!locks.framing) parts.push(at(ANGLE));
  parts.push(`any person: ${at(MOMENT, 2)}`);
  if (variety !== 'subtle') parts.push(at(BACKGROUND, 1));
  if (variety === 'bold' && !locks.light) parts.push(at(LIGHT));
  if (variety === 'bold' && !locks.framing) parts.push(at(SETTING));
  return `${AUTO_PREFIX} ${seq}: ${parts.join('; ')}.`;
}

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

  const startSeq = input.startSeq ?? 1;
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
    const variety = input.variety ?? 'balanced';
    const locks = input.locks ?? { framing: false, light: false };
    concepts = [];
    for (let i = 0; i < count; i++) {
      const hint = input.concepts[i];
      concepts.push(hint && hint.trim().length > 0 ? hint.trim() : autoVariation(startSeq + i, variety, locks));
    }
  }

  const seen = new Map<string, number>();
  for (const e of input.existing ?? []) {
    if (!seen.has(e.normalized)) seen.set(e.normalized, e.seq);
  }
  const jobs: PlannedJob[] = [];
  concepts.forEach((concept, i) => {
    const seq = startSeq + i;
    const normalized = normalizeConcept(concept);
    let duplicateOfSeq: number | null = null;
    if (!isAutoConcept(concept)) {
      const prior = seen.get(normalized);
      if (prior !== undefined) duplicateOfSeq = prior;
      else seen.set(normalized, seq);
    }
    jobs.push({ seq, concept, normalized, duplicateOfSeq });
  });
  return jobs;
}

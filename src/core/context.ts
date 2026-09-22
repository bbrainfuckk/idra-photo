import type { Db } from '../storage/db.js';
import type { Repo } from '../storage/repo.js';
import type { ImageLimits } from '../artifacts/validate.js';
import { IdraError } from './errors.js';

export interface Limits {
  image: ImageLimits;
  maxRetries: number;
  /** Cooldown before automatic retry n (1-based); the last value repeats. */
  backoffSeconds: number[];
  maxReferences: number;
}

export interface ChangeEvent {
  kind: string;
}

/** Side effects run after a transaction commits. They must never break the queue. */
export interface QueueHooks {
  afterChange(batchId: string, event: ChangeEvent): void;
}

export interface Ctx {
  root: string;
  rootReal: string;
  idraDir: string;
  stagingRoot: string;
  referencesRoot: string;
  outputsRoot: string;
  allowImportsReal: string[];
  db: Db;
  repo: Repo;
  limits: Limits;
  simulation: boolean;
  staleClaimMs: number;
  /** Test-only crash injection points. Empty in production. */
  faults: Set<string>;
  hooks: QueueHooks;
  log: (msg: string) => void;
}

export function fault(ctx: Ctx, point: string): void {
  if (ctx.faults.has(point)) throw new IdraError('INTERNAL', `injected fault: ${point}`, { fault: point });
}

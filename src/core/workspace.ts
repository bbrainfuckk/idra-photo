import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Db } from '../storage/db.js';
import { Repo } from '../storage/repo.js';
import { DEFAULT_LIMITS } from '../artifacts/validate.js';
import { ensureDir, realpathLenient } from '../artifacts/paths.js';
import { IdraError } from './errors.js';
import type { Ctx, Limits, QueueHooks } from './context.js';
import { writeManifest } from './manifest.js';

export interface OpenOptions {
  root: string;
  allowImports?: string[];
  simulation?: boolean;
  staleClaimMinutes?: number;
  limits?: Partial<Limits>;
  faults?: Set<string>;
  hooks?: QueueHooks;
  log?: (msg: string) => void;
}

export const DEFAULT_QUEUE_LIMITS: Limits = {
  image: DEFAULT_LIMITS,
  maxRetries: 2,
  backoffSeconds: [30, 120],
  maxReferences: 8,
};

/** Refuse roots that would expose far more than a dedicated folder. */
export function assertAcceptableRoot(rootReal: string): void {
  const home = realpathLenient(os.homedir());
  const same = (a: string, b: string) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  if (same(rootReal, home)) throw new IdraError('PATH_UNSAFE', 'the workspace cannot be your home directory; choose a dedicated folder such as ~/Pictures/Idra Photo');
  if (same(rootReal, path.parse(rootReal).root)) throw new IdraError('PATH_UNSAFE', 'the workspace cannot be a filesystem root');
}

export function openWorkspace(opts: OpenOptions): Ctx {
  if (!opts.root || !path.isAbsolute(opts.root)) {
    throw new IdraError('INVALID_INPUT', 'an absolute --workspace path is required');
  }
  ensureDir(opts.root);
  const rootReal = fs.realpathSync.native(opts.root);
  assertAcceptableRoot(rootReal);
  const idraDir = path.join(rootReal, '.idra');
  const stagingRoot = path.join(idraDir, 'staging');
  const referencesRoot = path.join(idraDir, 'references');
  const outputsRoot = path.join(rootReal, 'outputs');
  for (const d of [idraDir, stagingRoot, referencesRoot, path.join(idraDir, 'orphans'), outputsRoot]) ensureDir(d);

  const log = opts.log ?? ((m: string) => process.stderr.write(`[idra] ${m}\n`));
  const allowImportsReal: string[] = [];
  for (const dir of opts.allowImports ?? []) {
    if (!path.isAbsolute(dir)) {
      log(`ignoring non-absolute --allow-import ${dir}`);
      continue;
    }
    if (!fs.existsSync(dir)) {
      log(`--allow-import directory does not exist yet, skipped: ${dir}`);
      continue;
    }
    const real = fs.realpathSync.native(dir);
    try {
      assertAcceptableRoot(real);
    } catch {
      log(`refusing --allow-import for a home or filesystem root: ${dir}`);
      continue;
    }
    allowImportsReal.push(real);
  }

  const db = new Db(path.join(idraDir, 'state.sqlite'));
  db.migrate();
  const repo = new Repo(db);
  const limits: Limits = { ...DEFAULT_QUEUE_LIMITS, ...(opts.limits ?? {}) };

  const ctx: Ctx = {
    root: opts.root,
    rootReal,
    idraDir,
    stagingRoot,
    referencesRoot,
    outputsRoot,
    allowImportsReal,
    db,
    repo,
    limits,
    simulation: opts.simulation ?? false,
    staleClaimMs: Math.max(0, (opts.staleClaimMinutes ?? 20) * 60_000),
    faults: opts.faults ?? new Set(),
    hooks: opts.hooks ?? {
      afterChange: (batchId: string) => {
        try {
          writeManifest(ctx, batchId);
        } catch (err) {
          log(`manifest export failed for ${batchId}: ${(err as Error).message}`);
        }
      },
    },
    log,
  };
  return ctx;
}

export function closeWorkspace(ctx: Ctx): void {
  ctx.db.close();
}

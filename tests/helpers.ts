import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openWorkspace, type OpenOptions } from '../src/core/workspace.js';
import { createBatch, step, type CreateBatchInput, type JobPayload, type StepResult } from '../src/core/queue.js';
import type { Ctx } from '../src/core/context.js';
import { makePng } from '../src/sim/fixtures.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Compiled CLI entry (tests run from dist/tests). */
export const CLI = path.resolve(here, '..', 'src', 'cli.js');
export const REPO_ROOT = path.resolve(here, '..', '..');

const created: string[] = [];
process.on('exit', () => {
  if (process.env['IDRA_KEEP_TEST_DIRS']) return;
  for (const d of created) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* a file may still be locked on Windows; the OS temp cleaner will get it */
    }
  }
});

export function tmpWorkspace(prefix = 'idra-test-'): string {
  const d = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  created.push(d);
  return d;
}

export function open(ws: string, extra: Partial<OpenOptions> = {}): Ctx {
  return openWorkspace({ root: ws, log: () => undefined, ...extra });
}

let counter = 0;
export function key(): string {
  return `k-${process.pid}-${Date.now()}-${counter++}`;
}

export function refPng(ws: string, name = 'ref.png', seed = 1): string {
  const p = path.join(ws, 'references', name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, makePng(40, 50, seed));
  return p;
}

export function create(ctx: Ctx, count: number, extra: Partial<CreateBatchInput> = {}): string {
  const r = createBatch(ctx, { idempotency_key: key(), request: 'test request', count, base_prompt: 'A bottle on marble', ...extra });
  return r['batch_id'] as string;
}

/** Simulated host generation: write a unique fixture PNG to the job's save_to. */
export function gen(job: JobPayload, seed = job.seq * 7919 + 13): string {
  fs.mkdirSync(path.dirname(job.save_to), { recursive: true });
  fs.writeFileSync(job.save_to, makePng(64, 80, seed));
  return job.save_to;
}

export function claim(ctx: Ctx, batchId: string): JobPayload {
  const r = step(ctx, { batch_id: batchId });
  if (r.status !== 'job' || !r.job) throw new Error(`expected job, got ${JSON.stringify(r)}`);
  return r.job;
}

export function complete(ctx: Ctx, batchId: string, job: JobPayload, artifactPath?: string): StepResult {
  return step(ctx, { batch_id: batchId, completed: { job_id: job.job_id, attempt_token: job.attempt_token, artifact_path: artifactPath } });
}

export function outputFiles(ctx: Ctx, batchId: string): string[] {
  const b = ctx.repo.getBatch(batchId)!;
  if (!fs.existsSync(b.output_dir)) return [];
  return fs.readdirSync(b.output_dir).filter((f) => f !== 'manifest.json');
}

export function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (err) {
    const c = (err as { code?: string }).code;
    if (c === code) return;
    throw new Error(`expected ${code}, got ${c}: ${(err as Error).message}`);
  }
  throw new Error(`expected ${code}, but no error was thrown`);
}

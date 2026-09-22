import fs from 'node:fs';
import path from 'node:path';
import type { Ctx } from './context.js';
import { fault } from './context.js';
import { IdraError } from './errors.js';
import { isoPlusSeconds, newId, newToken, nowIso, sha256Hex, slugify, stableHash } from './ids.js';
import { constraintWarnings, normalizeConstraints, type Constraints } from './constraints.js';
import { GENERIC_VARIATION, MAX_BATCH_COUNT, planJobs, type PlanningMode } from './planning.js';
import { assemblePrompt } from './prompt.js';
import { importReference, referenceAvailable, type ReferenceInput } from './references.js';
import type { AttemptRow, BatchRow, Counts, JobRow, ReferenceRow } from '../storage/repo.js';
import { aspectMatches, aspectString, validateImageFile, type ImageInfo } from '../artifacts/validate.js';
import { ensureDir, isInside, realpathLenient, resolveWithin } from '../artifacts/paths.js';
import { finalArtifactPath, finalizeArtifact, findStagedCandidate, stagingDirFor, stagingSuggestedPath } from '../artifacts/staging.js';

// ---------------------------------------------------------------- types

export type StepStatus = 'job' | 'done' | 'paused' | 'blocked' | 'cancelled' | 'exhausted_with_errors';

export interface JobPayload {
  job_id: string;
  seq: number;
  attempt_token: string;
  prompt: string;
  references: { label: string; role: string; path: string }[];
  aspect: string | null;
  save_to: string;
  note?: string;
}

export interface StepResult {
  status: StepStatus;
  batch_id: string;
  progress: string;
  counts: Partial<Counts>;
  job?: JobPayload;
  saved?: { seq: number; file: string };
  reason?: string;
  detail?: Record<string, unknown>;
  retry_after?: string;
  output_dir?: string;
  next?: string;
  replayed?: boolean;
}

export interface CreateBatchInput {
  idempotency_key: string;
  request: string;
  count: number;
  planning_mode?: PlanningMode | undefined;
  base_prompt?: string | undefined;
  concepts?: string[] | undefined;
  references?: ReferenceInput[] | undefined;
  constraints?: unknown;
  target_aspect?: string | undefined;
  name?: string | undefined;
  max_retries?: number | undefined;
}

export interface Completion {
  job_id: string;
  attempt_token: string;
  artifact_path?: string | undefined;
  review?: { performed: boolean; passed?: boolean | undefined; notes?: string | undefined } | undefined;
}

export interface StepInput {
  batch_id: string;
  completed?: Completion | undefined;
  request_id?: string | undefined;
}

export type ProblemClass = 'transient' | 'usage_limit' | 'tool_unavailable' | 'permission_denied' | 'safety_refusal' | 'invalid_output' | 'unknown';

export interface ProblemInput {
  batch_id: string;
  job_id: string;
  attempt_token: string;
  classification: ProblemClass;
  message: string;
  retryable?: boolean | undefined;
}

export type ControlAction = 'pause' | 'resume' | 'cancel' | 'retry_failed';

export interface ExtendInput {
  batch_id: string;
  idempotency_key: string;
  count: number;
  concepts?: string[] | undefined;
}

export type ReconcileAction = 'check' | 'adopt' | 'confirm_failed' | 'authorize_retry';

export interface ReconcileInput {
  batch_id: string;
  job_id: string;
  action: ReconcileAction;
  artifact_path?: string | undefined;
  note?: string | undefined;
  accept_duplicate?: boolean | undefined;
}

// ---------------------------------------------------------------- helpers

function mustBatch(ctx: Ctx, id: string): BatchRow {
  const b = ctx.repo.getBatch(id);
  if (!b) throw new IdraError('BATCH_NOT_FOUND', `no batch ${id}`, { batch_id: id });
  return b;
}

function mustJob(ctx: Ctx, batchId: string, jobId: string): JobRow {
  const j = ctx.repo.getJob(jobId);
  if (!j || j.batch_id !== batchId) throw new IdraError('JOB_NOT_FOUND', `no job ${jobId} in batch ${batchId}`, { job_id: jobId });
  return j;
}

export function compactCounts(c: Counts): Partial<Counts> {
  const out: Partial<Counts> = { requested: c.requested, completed: c.completed };
  for (const k of ['pending', 'cooling', 'claimed', 'failed', 'uncertain', 'cancelled'] as const) if (c[k] > 0) out[k] = c[k];
  return out;
}

function base(ctx: Ctx, b: BatchRow): Pick<StepResult, 'batch_id' | 'progress' | 'counts'> {
  const c = ctx.repo.counts(b.id, nowIso());
  return { batch_id: b.id, progress: `${c.completed}/${c.requested}`, counts: compactCounts(c) };
}

function afterChange(ctx: Ctx, batchId: string, kind: string): void {
  try {
    ctx.hooks.afterChange(batchId, { kind });
  } catch (err) {
    ctx.log(`afterChange hook failed: ${(err as Error).message}`);
  }
}

function uniqueSlug(ctx: Ctx, wanted: string): string {
  const s = slugify(wanted, 40);
  if (!ctx.repo.slugExists(s)) return s;
  for (let i = 2; i < 10_000; i++) {
    const c = `${s}-${i}`;
    if (!ctx.repo.slugExists(c)) return c;
  }
  return `${s}-${newId('x').slice(2)}`;
}

function refPayload(refs: ReferenceRow[]): JobPayload['references'] {
  return refs.map((r) => ({ label: r.label, role: r.role, path: r.stored_path }));
}

function checkOp(ctx: Ctx, key: string, requestHash: string): unknown | undefined {
  const prior = ctx.repo.getOperation(key);
  if (!prior) return undefined;
  if (prior.request_hash !== requestHash) {
    throw new IdraError('IDEMPOTENCY_CONFLICT', 'this idempotency key was already used with different input', { key });
  }
  return { ...(JSON.parse(prior.response_json) as object), replayed: true };
}

const ASPECT_RE = /^\d{1,2}:\d{1,2}$/;

// ---------------------------------------------------------------- create

export function createBatch(ctx: Ctx, input: CreateBatchInput): Record<string, unknown> {
  const mode: PlanningMode = input.planning_mode ?? 'variations';
  const reqHash = stableHash({ ...input, planning_mode: mode });
  const opKey = `create:${input.idempotency_key}`;
  const replay = checkOp(ctx, opKey, reqHash);
  if (replay) return replay as Record<string, unknown>;

  if (!input.request || input.request.length > 8000) throw new IdraError('INVALID_INPUT', 'request must be 1-8000 characters');
  if (input.target_aspect && !ASPECT_RE.test(input.target_aspect)) throw new IdraError('INVALID_INPUT', 'target_aspect must look like 4:5');
  const constraints: Constraints = normalizeConstraints(input.constraints ?? {});
  const refsIn = input.references ?? [];
  if (refsIn.length > ctx.limits.maxReferences) throw new IdraError('INVALID_INPUT', `at most ${ctx.limits.maxReferences} references`);
  const basePrompt = input.base_prompt?.trim() || null;
  const plan = planJobs({ mode, count: input.count, concepts: input.concepts ?? [], basePrompt });
  const maxRetries = Math.min(Math.max(input.max_retries ?? ctx.limits.maxRetries, 0), 5);

  if (constraints.style !== 'off' && !refsIn.some((r) => r.role === 'style') && constraints.style_details === undefined) {
    // Style matching with no style reference and no description would be an empty requirement.
    throw new IdraError('CONSTRAINT_CONFLICT', 'style constraint needs a reference with role "style" or style_details');
  }
  const batchId = newId('b');
  const refs: ReferenceRow[] = [];
  try {
    refsIn.forEach((r, i) => refs.push(importReference(ctx, batchId, r, i)));
  } catch (err) {
    fs.rmSync(path.join(ctx.referencesRoot, batchId), { recursive: true, force: true });
    throw err;
  }
  const warnings = constraintWarnings(constraints, mode);
  const refLabels = refs.map((r) => ({ label: r.label, role: r.role }));

  let result: Record<string, unknown>;
  try {
    result = ctx.db.transaction(() => {
      const again = checkOp(ctx, opKey, reqHash);
      if (again) return again as Record<string, unknown>;
      const now = nowIso();
      const slug = uniqueSlug(ctx, input.name || basePrompt || input.request);
      const outputDir = path.join(ctx.outputsRoot, slug);
      ctx.repo.insertBatch({
        id: batchId,
        slug,
        idempotency_key: input.idempotency_key,
        created_at: now,
        updated_at: now,
        request_text: input.request,
        planning_mode: mode,
        base_prompt: basePrompt,
        requested_count: plan.length,
        constraints_json: JSON.stringify(constraints),
        target_aspect: input.target_aspect ?? null,
        status: 'active',
        paused: 0,
        pause_reason: null,
        output_dir: outputDir,
        max_retries: maxRetries,
        simulated: ctx.simulation ? 1 : 0,
      });
      for (const r of refs) ctx.repo.insertReference(r);
      for (const p of plan) {
        ctx.repo.insertJob({
          id: newId('j'),
          batch_id: batchId,
          seq: p.seq,
          concept: p.concept,
          normalized_concept: p.normalized,
          prompt: assemblePrompt({ mode, concept: p.concept, basePrompt, constraints, references: refLabels, targetAspect: input.target_aspect ?? null }),
          state: 'pending',
          attempts_count: 0,
          retries_used: 0,
          next_eligible_at: null,
          active_attempt_id: null,
          duplicate_of_seq: p.duplicateOfSeq,
          last_error_json: null,
          created_at: now,
          updated_at: now,
        });
      }
      ctx.repo.event('batch_created', { batchId }, { count: plan.length, mode, references: refs.length });
      const dupes = plan.filter((p) => p.duplicateOfSeq !== null).map((p) => p.seq);
      const res: Record<string, unknown> = {
        batch_id: batchId,
        handle: `idra://batch/${batchId}`,
        slug,
        output_dir: outputDir,
        count: plan.length,
        references: refs.map((r) => `${r.label} (${r.role})`),
        ...(warnings.length ? { warnings: warnings.map((w) => w.message) } : {}),
        ...(dupes.length ? { duplicate_concepts: dupes } : {}),
        next: 'Call idra_step with batch_id to get job 1.',
      };
      ctx.repo.putOperation(opKey, 'idra_create_batch', reqHash, res);
      return res;
    });
  } catch (err) {
    fs.rmSync(path.join(ctx.referencesRoot, batchId), { recursive: true, force: true });
    throw err;
  }
  if (result['replayed']) fs.rmSync(path.join(ctx.referencesRoot, batchId), { recursive: true, force: true });
  else afterChange(ctx, batchId, 'batch_created');
  return result;
}

// ---------------------------------------------------------------- claiming

/** Must run inside a transaction. Claims at most one job, never while another is active. */
function claimNextLocked(ctx: Ctx, batchId: string): StepResult {
  const b = mustBatch(ctx, batchId);
  const now = nowIso();
  const counts = ctx.repo.counts(b.id, now);
  const head = { batch_id: b.id, progress: `${counts.completed}/${counts.requested}`, counts: compactCounts(counts) };
  if (b.status === 'cancelled') return { ...head, status: 'cancelled', next: 'Batch was cancelled. Saved images are kept.' };
  if (b.paused) {
    return { ...head, status: 'paused', reason: b.pause_reason ?? 'paused', next: 'Tell the user why. Resume only when they ask (idra_control_batch action=resume).' };
  }
  const active = ctx.repo.claimedJob(b.id);
  if (active) return inProgress(ctx, head, active);
  if (counts.uncertain > 0) {
    return { ...head, status: 'blocked', reason: 'uncertain_needs_reconcile', next: 'Call idra_status, then idra_reconcile for each uncertain job.' };
  }
  const job = ctx.repo.nextEligibleJob(b.id, now);
  if (!job) {
    if (counts.cooling > 0) {
      const at = ctx.repo.earliestCooldown(b.id, now);
      return { ...head, status: 'blocked', reason: 'cooldown', ...(at ? { retry_after: at } : {}), next: 'A retry is cooling down. Tell the user; call idra_step again after retry_after.' };
    }
    if (counts.failed > 0 || counts.uncertain > 0) {
      const failed = ctx.repo
        .allJobs(b.id)
        .filter((j) => j.state === 'failed')
        .map((j) => j.seq)
        .slice(0, 20);
      return { ...head, status: 'exhausted_with_errors', detail: { failed_seqs: failed }, output_dir: b.output_dir, next: 'Report the failures. idra_control_batch action=retry_failed retries eligible ones if the user asks.' };
    }
    return { ...head, status: 'done', output_dir: b.output_dir, next: 'All images are saved. Show the user the output folder.' };
  }
  const refs = ctx.repo.listReferences(b.id);
  const missing = refs.filter((r) => !referenceAvailable(r));
  if (missing.length > 0) {
    ctx.repo.updateBatch(b.id, { paused: 1, pause_reason: 'reference_missing' });
    ctx.repo.event('reference_missing', { batchId: b.id }, { labels: missing.map((r) => r.label) });
    return { ...head, status: 'paused', reason: 'reference_missing', detail: { missing: missing.map((r) => r.stored_path) }, next: 'A reference image is gone. Ask the user to restore it; do not generate without it.' };
  }
  const n = job.attempts_count + 1;
  const attempt: AttemptRow = {
    id: newId('a'),
    job_id: job.id,
    batch_id: b.id,
    n,
    token: newToken(),
    state: 'claimed',
    staging_dir: stagingDirFor(ctx.stagingRoot, b.id, job.seq, n),
    claimed_at: now,
    resolved_at: null,
    error_json: null,
    evidence_json: null,
    artifact_sha256: null,
  };
  ensureDir(attempt.staging_dir);
  ctx.repo.insertAttempt(attempt);
  ctx.repo.updateJob(job.id, { state: 'claimed', active_attempt_id: attempt.id, attempts_count: n, next_eligible_at: null });
  ctx.repo.event('claimed', { batchId: b.id, jobId: job.id, attemptId: attempt.id }, { seq: job.seq, attempt: n });
  const after = ctx.repo.counts(b.id, now);
  const payload: JobPayload = {
    job_id: job.id,
    seq: job.seq,
    attempt_token: attempt.token,
    prompt: job.prompt,
    references: refPayload(refs),
    aspect: b.target_aspect,
    save_to: stagingSuggestedPath(attempt.staging_dir),
  };
  if (job.duplicate_of_seq) payload.note = `concept text duplicates #${job.duplicate_of_seq}`;
  if (n > 1) payload.note = `${payload.note ? payload.note + '; ' : ''}retry attempt ${n}`;
  return { batch_id: b.id, progress: `${after.completed}/${after.requested}`, counts: compactCounts(after), status: 'job', job: payload };
}

function inProgress(ctx: Ctx, head: Pick<StepResult, 'batch_id' | 'progress' | 'counts'>, job: JobRow): StepResult {
  const att = job.active_attempt_id ? ctx.repo.getAttempt(job.active_attempt_id) : undefined;
  return {
    ...head,
    status: 'blocked',
    reason: 'job_in_progress',
    detail: { seq: job.seq, job_id: job.id, claimed_at: att?.claimed_at, save_to: att ? stagingSuggestedPath(att.staging_dir) : undefined },
    next: `Job #${job.seq} is already claimed. If you generated it, report it via idra_step completed. If that session ended, call idra_reconcile action=check.`,
  };
}

// ---------------------------------------------------------------- artifacts

interface Prepared {
  info: ImageInfo;
  stagingPath: string;
  finalPath: string;
  sourcePath: string;
  imported: boolean;
  extensionMismatch: boolean;
}

function resolveArtifactSource(ctx: Ctx, attempt: AttemptRow, artifactPath: string): string {
  const real = resolveWithin([ctx.rootReal, ...ctx.allowImportsReal], artifactPath);
  const stagingReal = realpathLenient(attempt.staging_dir);
  if (isInside(stagingReal, real)) return real;
  if (isInside(ctx.stagingRoot, real)) {
    throw new IdraError('ARTIFACT_NOT_IN_STAGING', 'that file belongs to a different job attempt', { path: artifactPath });
  }
  if (isInside(ctx.outputsRoot, real) || isInside(ctx.referencesRoot, real)) {
    throw new IdraError('ARTIFACT_NOT_IN_STAGING', 'saved outputs and reference copies cannot be reported as new images', { path: artifactPath });
  }
  return real;
}

function prepareArtifact(ctx: Ctx, batch: BatchRow, job: JobRow, attempt: AttemptRow, artifactPath: string | undefined, acceptDuplicate: boolean): Prepared {
  let src: string;
  if (artifactPath) src = resolveArtifactSource(ctx, attempt, artifactPath);
  else {
    const found = findStagedCandidate(attempt.staging_dir);
    if (!found) {
      throw new IdraError('ARTIFACT_INVALID', 'no image found at save_to; save the generated image there or pass artifact_path', {
        reason: 'missing',
        save_to: stagingSuggestedPath(attempt.staging_dir),
      });
    }
    src = found;
  }
  const info = validateImageFile(src, ctx.limits.image);
  let stagingPath = src;
  let imported = false;
  if (!isInside(realpathLenient(attempt.staging_dir), src)) {
    ensureDir(attempt.staging_dir);
    stagingPath = path.join(attempt.staging_dir, `imported.${info.extension}`);
    if (fs.existsSync(stagingPath) && sha256Hex(fs.readFileSync(stagingPath)) !== info.sha256) {
      fs.renameSync(stagingPath, path.join(attempt.staging_dir, `imported-${Date.now()}.${info.extension}.prev`));
    }
    if (!fs.existsSync(stagingPath)) {
      const tmp = `${stagingPath}.${process.pid}.part`;
      fs.copyFileSync(src, tmp);
      fs.renameSync(tmp, stagingPath);
    }
    if (sha256Hex(fs.readFileSync(stagingPath)) !== info.sha256) throw new IdraError('IO_ERROR', 'staged copy does not match the source image');
    imported = true;
  }
  const ext = path.extname(stagingPath).slice(1).toLowerCase();
  const extensionMismatch = !(ext === info.extension || (ext === 'jpeg' && info.extension === 'jpg'));

  const refHit = ctx.repo.listReferences(batch.id).find((r) => r.sha256 === info.sha256);
  if (refHit) {
    ctx.repo.event('artifact_equals_reference', { batchId: batch.id, jobId: job.id, attemptId: attempt.id }, { label: refHit.label });
    throw new IdraError('ARTIFACT_CONFLICT', 'this file is identical to a reference image, not a new generation', { reason: 'equals_reference', label: refHit.label });
  }
  const dupes = ctx.repo.artifactsBySha(batch.id, info.sha256).filter((a) => a.job_id !== job.id);
  if (dupes.length > 0 && !acceptDuplicate) {
    const seqs = dupes.map((a) => ctx.repo.getJob(a.job_id)?.seq);
    ctx.repo.event('duplicate_artifact', { batchId: batch.id, jobId: job.id, attemptId: attempt.id }, { matches_seq: seqs, sha256: info.sha256 });
    throw new IdraError('ARTIFACT_CONFLICT', 'this exact file was already saved for another job; it is not counted as a new image', {
      reason: 'duplicate_artifact',
      matches_seq: seqs,
      resolve: 'generate a new image for this job, or idra_reconcile action=adopt accept_duplicate=true if the user wants it counted',
    });
  }
  fault(ctx, 'before_finalize');
  const nameSource = job.concept === GENERIC_VARIATION ? (batch.base_prompt ?? batch.slug) : job.concept;
  const finalPath = finalArtifactPath(batch.output_dir, job.seq, nameSource, info.extension);
  const orphanOk = !ctx.db.get('SELECT 1 AS x FROM artifacts WHERE final_path = ?', [finalPath]);
  finalizeArtifact(stagingPath, finalPath, info.sha256, orphanOk ? path.join(ctx.idraDir, 'orphans') : null);
  fault(ctx, 'after_finalize');
  return { info, stagingPath, finalPath, sourcePath: src, imported, extensionMismatch };
}

/** Must run inside a transaction. */
function recordCompletionLocked(ctx: Ctx, batch: BatchRow, job: JobRow, attempt: AttemptRow, p: Prepared, evidence: Record<string, unknown>, review: Completion['review']): void {
  const now = nowIso();
  const match = aspectMatches(batch.target_aspect, p.info.width, p.info.height);
  ctx.repo.insertArtifact({
    id: newId('art'),
    job_id: job.id,
    attempt_id: attempt.id,
    batch_id: batch.id,
    sha256: p.info.sha256,
    bytes: p.info.bytes,
    width: p.info.width,
    height: p.info.height,
    format: p.info.format,
    final_path: p.finalPath,
    staging_path: p.stagingPath,
    requested_aspect: batch.target_aspect,
    actual_aspect: aspectString(p.info.width, p.info.height),
    aspect_matches: match === null ? null : match ? 1 : 0,
    review_json: review ? JSON.stringify(review) : null,
    created_at: now,
  });
  ctx.repo.updateAttempt(attempt.id, {
    state: 'completed',
    resolved_at: now,
    artifact_sha256: p.info.sha256,
    evidence_json: JSON.stringify({ ...evidence, source: p.sourcePath, imported: p.imported, extension_mismatch: p.extensionMismatch }),
  });
  ctx.repo.updateJob(job.id, { state: 'completed', active_attempt_id: null, next_eligible_at: null, last_error_json: null });
  ctx.repo.event('completed', { batchId: batch.id, jobId: job.id, attemptId: attempt.id }, { seq: job.seq, sha256: p.info.sha256, file: path.basename(p.finalPath) });
  clearUncertainPause(ctx, batch.id);
}

function clearUncertainPause(ctx: Ctx, batchId: string): void {
  const b = mustBatch(ctx, batchId);
  if (b.paused && b.pause_reason === 'uncertain' && ctx.repo.counts(batchId, nowIso()).uncertain === 0) {
    ctx.repo.updateBatch(batchId, { paused: 0, pause_reason: null });
    ctx.repo.event('unpaused', { batchId }, { reason: 'uncertain resolved' });
  }
}

// ---------------------------------------------------------------- step

function replayStep(ctx: Ctx, stored: StepResult, batchId: string): StepResult {
  if (stored.status === 'job' && stored.job) {
    const att = ctx.repo.getAttemptByToken(stored.job.attempt_token);
    if (att && att.state === 'claimed') return { ...stored, replayed: true };
    const b = mustBatch(ctx, batchId);
    return { ...base(ctx, b), status: 'blocked', reason: 'stale_replay', saved: stored.saved, replayed: true, next: 'That response is out of date. Call idra_step without completed to continue.' } as StepResult;
  }
  return { ...stored, replayed: true };
}

export function step(ctx: Ctx, input: StepInput): StepResult {
  const batch = mustBatch(ctx, input.batch_id);
  if (input.completed) return completeAndNext(ctx, batch, input.completed);

  const reqKey = input.request_id ? `stepreq:${batch.id}:${input.request_id}` : null;
  if (reqKey) {
    const prior = ctx.repo.getOperation(reqKey);
    if (prior) return replayStep(ctx, JSON.parse(prior.response_json) as StepResult, batch.id);
  }
  const res = ctx.db.transaction((): StepResult => {
    if (reqKey) {
      const again = ctx.repo.getOperation(reqKey);
      if (again) return replayStep(ctx, JSON.parse(again.response_json) as StepResult, batch.id);
    }
    const claimed = ctx.repo.claimedJob(batch.id);
    if (claimed) {
      const att = claimed.active_attempt_id ? ctx.repo.getAttempt(claimed.active_attempt_id) : undefined;
      const age = att ? Date.now() - Date.parse(att.claimed_at) : 0;
      if (att && age > ctx.staleClaimMs) {
        // Abandoned claim: never reissue silently. It stays uncertain until reconciled.
        ctx.repo.updateAttempt(att.id, { state: 'uncertain' });
        ctx.repo.updateJob(claimed.id, { state: 'uncertain' });
        ctx.repo.updateBatch(batch.id, { paused: 1, pause_reason: 'uncertain' });
        ctx.repo.event('claim_marked_uncertain', { batchId: batch.id, jobId: claimed.id, attemptId: att.id }, { age_ms: age });
        const b = mustBatch(ctx, batch.id);
        return {
          ...base(ctx, b),
          status: 'blocked',
          reason: 'uncertain_needs_reconcile',
          detail: { seq: claimed.seq, job_id: claimed.id, save_to: stagingSuggestedPath(att.staging_dir) },
          next: `Job #${claimed.seq} was claimed ${Math.round(age / 60000)} min ago with no result. Call idra_reconcile action=check for it.`,
        };
      }
      return inProgress(ctx, base(ctx, mustBatch(ctx, batch.id)), claimed);
    }
    const r = claimNextLocked(ctx, batch.id);
    if (reqKey) ctx.repo.putOperation(reqKey, 'idra_step', stableHash(input), r);
    return r;
  });
  afterChange(ctx, batch.id, 'step');
  return res;
}

function completeAndNext(ctx: Ctx, batch: BatchRow, c: Completion): StepResult {
  const attempt = ctx.repo.getAttemptByToken(c.attempt_token);
  if (!attempt) throw new IdraError('ATTEMPT_NOT_FOUND', 'unknown attempt_token; use the token from the job you generated', { job_id: c.job_id });
  if (attempt.batch_id !== batch.id || attempt.job_id !== c.job_id) {
    throw new IdraError('ATTEMPT_TOKEN_MISMATCH', 'attempt_token does not belong to this job', { job_id: c.job_id });
  }
  const opKey = `step:${c.attempt_token}`;
  const prior = ctx.repo.getOperation(opKey);
  if (prior) {
    if (c.artifact_path && attempt.artifact_sha256) {
      const sha = sha256Hex(fs.readFileSync(resolveWithin([ctx.rootReal, ...ctx.allowImportsReal], c.artifact_path)));
      if (sha !== attempt.artifact_sha256) {
        throw new IdraError('ARTIFACT_CONFLICT', 'this job is already completed with a different image; it is not replaced', { job_id: c.job_id });
      }
    }
    return replayStep(ctx, JSON.parse(prior.response_json) as StepResult, batch.id);
  }
  if (attempt.state === 'completed') {
    throw new IdraError('ATTEMPT_ALREADY_COMPLETED', 'this attempt was already completed via reconcile; call idra_step without completed to continue', { job_id: c.job_id });
  }
  if (attempt.state !== 'claimed' && attempt.state !== 'uncertain') {
    throw new IdraError('ATTEMPT_ALREADY_RESOLVED', `this attempt is ${attempt.state}; its result can no longer be reported`, { job_id: c.job_id, state: attempt.state });
  }
  const job = mustJob(ctx, batch.id, attempt.job_id);
  const prep = prepareArtifact(ctx, batch, job, attempt, c.artifact_path, false);
  const res = ctx.db.transaction((): StepResult => {
    const again = ctx.repo.getOperation(opKey);
    if (again) return replayStep(ctx, JSON.parse(again.response_json) as StepResult, batch.id);
    const fresh = ctx.repo.getAttempt(attempt.id)!;
    if (fresh.state !== 'claimed' && fresh.state !== 'uncertain') {
      throw new IdraError('ATTEMPT_ALREADY_RESOLVED', `this attempt is ${fresh.state}`, { job_id: c.job_id });
    }
    recordCompletionLocked(ctx, batch, job, fresh, prep, { via: 'idra_step' }, c.review);
    const next = claimNextLocked(ctx, batch.id);
    const out: StepResult = { ...next, saved: { seq: job.seq, file: path.basename(prep.finalPath) } };
    ctx.repo.putOperation(opKey, 'idra_step', stableHash({ job_id: c.job_id, token: c.attempt_token }), out);
    fault(ctx, 'before_commit');
    return out;
  });
  fault(ctx, 'after_commit');
  afterChange(ctx, batch.id, 'completed');
  return res;
}

// ---------------------------------------------------------------- problems

export function reportProblem(ctx: Ctx, input: ProblemInput): StepResult {
  const batch = mustBatch(ctx, input.batch_id);
  const attempt = ctx.repo.getAttemptByToken(input.attempt_token);
  if (!attempt || attempt.batch_id !== batch.id || attempt.job_id !== input.job_id) {
    throw new IdraError('ATTEMPT_TOKEN_MISMATCH', 'attempt_token does not belong to this job', { job_id: input.job_id });
  }
  const opKey = `problem:${input.attempt_token}`;
  const reqHash = stableHash({ c: input.classification, m: input.message, r: input.retryable ?? null });
  const replay = checkOp(ctx, opKey, reqHash);
  if (replay) return replay as StepResult;
  if (attempt.state !== 'claimed' && attempt.state !== 'uncertain') {
    throw new IdraError('ATTEMPT_ALREADY_RESOLVED', `this attempt is ${attempt.state}`, { job_id: input.job_id });
  }
  const res = ctx.db.transaction((): StepResult => {
    const job = mustJob(ctx, batch.id, input.job_id);
    const now = nowIso();
    const cls = input.classification;
    const retryable = cls === 'safety_refusal' ? false : (input.retryable ?? cls !== 'unknown');
    const err = { classification: cls, message: input.message.slice(0, 1000), retryable, attempt: attempt.n, at: now };
    ctx.repo.updateAttempt(attempt.id, { state: 'failed', resolved_at: now, error_json: JSON.stringify(err) });
    let jobState: JobRow['state'] = 'failed';
    let nextEligible: string | null = null;
    let retriesUsed = job.retries_used;
    let pause: string | null = null;
    let outcome: string;
    if (cls === 'transient' || cls === 'invalid_output') {
      if (retryable && job.retries_used < batch.max_retries) {
        retriesUsed += 1;
        const delays = ctx.limits.backoffSeconds;
        nextEligible = isoPlusSeconds(delays[Math.min(retriesUsed - 1, delays.length - 1)] ?? 60);
        jobState = 'pending';
        outcome = `will retry after ${nextEligible} (retry ${retriesUsed} of ${batch.max_retries})`;
      } else {
        outcome = 'retries exhausted; job failed';
      }
    } else if (cls === 'usage_limit' || cls === 'tool_unavailable' || cls === 'permission_denied') {
      jobState = 'pending';
      pause = cls;
      outcome = 'batch paused; this job will run again after the user resumes';
    } else if (cls === 'safety_refusal') {
      pause = 'safety_refusal';
      outcome = 'job failed and batch paused; the prompt is not changed automatically';
    } else {
      pause = 'unknown_failure';
      outcome = 'job failed and batch paused for review';
    }
    ctx.repo.updateJob(job.id, { state: jobState, active_attempt_id: null, next_eligible_at: nextEligible, retries_used: retriesUsed, last_error_json: JSON.stringify(err) });
    if (pause) ctx.repo.updateBatch(batch.id, { paused: 1, pause_reason: pause });
    ctx.repo.event('problem', { batchId: batch.id, jobId: job.id, attemptId: attempt.id }, err);
    clearUncertainPause(ctx, batch.id);
    const b = mustBatch(ctx, batch.id);
    const out: StepResult = {
      ...base(ctx, b),
      status: b.paused ? 'paused' : 'blocked',
      reason: pause ?? cls,
      detail: { seq: job.seq, outcome },
      next: b.paused ? 'Tell the user what happened. Do not retry or reword the prompt on your own.' : 'Call idra_step (no completed) to continue with the next job.',
    };
    ctx.repo.putOperation(opKey, 'idra_report_problem', reqHash, out);
    return out;
  });
  afterChange(ctx, batch.id, 'problem');
  return res;
}

// ---------------------------------------------------------------- control

export function controlBatch(ctx: Ctx, batchId: string, action: ControlAction): Record<string, unknown> {
  const res = ctx.db.transaction(() => {
    const b = mustBatch(ctx, batchId);
    let note = '';
    if (action === 'pause') {
      if (b.status === 'cancelled') throw new IdraError('BATCH_CANCELLED', 'batch is cancelled');
      if (!b.paused) ctx.repo.updateBatch(b.id, { paused: 1, pause_reason: 'user' });
      note = 'Paused. A job already being generated can still be reported.';
    } else if (action === 'resume') {
      if (b.status === 'cancelled') throw new IdraError('BATCH_CANCELLED', 'a cancelled batch cannot be resumed; extend a new batch instead');
      ctx.repo.updateBatch(b.id, { paused: 0, pause_reason: null });
      const unc = ctx.repo.counts(b.id, nowIso()).uncertain;
      note = unc > 0 ? `Resumed, but ${unc} uncertain job(s) must be reconciled first.` : 'Resumed. Call idra_step to continue.';
    } else if (action === 'cancel') {
      if (b.status !== 'cancelled') {
        const n = ctx.repo.cancelPendingJobs(b.id);
        ctx.repo.updateBatch(b.id, { status: 'cancelled', paused: 0, pause_reason: null });
        note = `Cancelled ${n} pending job(s). Saved images are kept. An image already being generated can still be reported.`;
      } else note = 'Already cancelled.';
    } else {
      if (b.status === 'cancelled') throw new IdraError('BATCH_CANCELLED', 'batch is cancelled');
      const failed = ctx.repo.allJobs(b.id).filter((j) => j.state === 'failed');
      let n = 0;
      for (const j of failed) {
        const err = j.last_error_json ? (JSON.parse(j.last_error_json) as { retryable?: boolean }) : {};
        if (err.retryable === false) continue;
        ctx.repo.updateJob(j.id, { state: 'pending', next_eligible_at: null });
        n++;
      }
      note = `${n} failed job(s) queued again${failed.length - n ? `; ${failed.length - n} not eligible (safety refusal or marked non-retryable)` : ''}.${b.paused ? ' Batch is still paused; resume to continue.' : ''}`;
    }
    ctx.repo.event(`control_${action}`, { batchId: b.id }, null);
    const fresh = mustBatch(ctx, b.id);
    return { ...base(ctx, fresh), status: fresh.status, paused: fresh.paused === 1, pause_reason: fresh.pause_reason, note };
  });
  afterChange(ctx, batchId, `control_${action}`);
  return res;
}

// ---------------------------------------------------------------- extend

export function extendBatch(ctx: Ctx, input: ExtendInput): Record<string, unknown> {
  const opKey = `extend:${input.batch_id}:${input.idempotency_key}`;
  const reqHash = stableHash(input);
  const replay = checkOp(ctx, opKey, reqHash);
  if (replay) return replay as Record<string, unknown>;
  const res = ctx.db.transaction(() => {
    const again = checkOp(ctx, opKey, reqHash);
    if (again) return again as Record<string, unknown>;
    const b = mustBatch(ctx, input.batch_id);
    if (b.status === 'cancelled') throw new IdraError('BATCH_CANCELLED', 'a cancelled batch cannot be extended');
    const total = b.requested_count + input.count;
    if (total > MAX_BATCH_COUNT) throw new IdraError('PLAN_INVALID', `a batch holds at most ${MAX_BATCH_COUNT} jobs`);
    const existing = ctx.repo.allJobs(b.id).map((j) => ({ seq: j.seq, normalized: j.normalized_concept }));
    const startSeq = ctx.repo.maxSeq(b.id) + 1;
    const plan = planJobs({ mode: b.planning_mode, count: input.count, concepts: input.concepts ?? [], basePrompt: b.base_prompt, startSeq, existing });
    const constraints = JSON.parse(b.constraints_json) as Constraints;
    const refs = ctx.repo.listReferences(b.id).map((r) => ({ label: r.label, role: r.role }));
    const now = nowIso();
    for (const p of plan) {
      ctx.repo.insertJob({
        id: newId('j'),
        batch_id: b.id,
        seq: p.seq,
        concept: p.concept,
        normalized_concept: p.normalized,
        prompt: assemblePrompt({ mode: b.planning_mode, concept: p.concept, basePrompt: b.base_prompt, constraints, references: refs, targetAspect: b.target_aspect }),
        state: 'pending',
        attempts_count: 0,
        retries_used: 0,
        next_eligible_at: null,
        active_attempt_id: null,
        duplicate_of_seq: p.duplicateOfSeq,
        last_error_json: null,
        created_at: now,
        updated_at: now,
      });
    }
    ctx.repo.updateBatch(b.id, { requested_count: total });
    ctx.repo.event('extended', { batchId: b.id }, { added: plan.length, from_seq: startSeq });
    const out = { ...base(ctx, mustBatch(ctx, b.id)), added: plan.length, seqs: `${startSeq}-${startSeq + plan.length - 1}`, next: 'Call idra_step to continue.' };
    ctx.repo.putOperation(opKey, 'idra_extend', reqHash, out);
    return out;
  });
  afterChange(ctx, input.batch_id, 'extended');
  return res;
}

// ---------------------------------------------------------------- reconcile

export function reconcile(ctx: Ctx, input: ReconcileInput): Record<string, unknown> {
  const batch = mustBatch(ctx, input.batch_id);
  const job = mustJob(ctx, batch.id, input.job_id);
  if (job.state === 'completed') {
    const a = ctx.repo.getArtifactByJob(job.id);
    return { ...base(ctx, batch), job: job.seq, state: 'completed', file: a ? path.basename(a.final_path) : null, note: 'Already completed; nothing to reconcile.' };
  }
  const attempt = job.active_attempt_id ? ctx.repo.getAttempt(job.active_attempt_id) : undefined;
  if (!attempt || (attempt.state !== 'claimed' && attempt.state !== 'uncertain')) {
    if (input.action === 'authorize_retry' && job.state === 'failed') {
      throw new IdraError('JOB_STATE_INVALID', 'use idra_control_batch action=retry_failed for failed jobs');
    }
    throw new IdraError('JOB_STATE_INVALID', `job #${job.seq} is ${job.state} with no open attempt`, { state: job.state });
  }

  if (input.action === 'check' || input.action === 'adopt') {
    if (input.action === 'adopt' && !input.artifact_path) throw new IdraError('INVALID_INPUT', 'adopt needs artifact_path');
    let prep: Prepared;
    try {
      prep = prepareArtifact(ctx, batch, job, attempt, input.action === 'adopt' ? input.artifact_path : undefined, input.accept_duplicate === true);
    } catch (err) {
      if (!(err instanceof IdraError) || !['ARTIFACT_INVALID', 'ARTIFACT_CONFLICT'].includes(err.code)) throw err;
      ctx.db.transaction(() => {
        ctx.repo.updateAttempt(attempt.id, { state: 'uncertain' });
        ctx.repo.updateJob(job.id, { state: 'uncertain' });
        const b = mustBatch(ctx, batch.id);
        if (!b.paused && b.status === 'active') ctx.repo.updateBatch(batch.id, { paused: 1, pause_reason: 'uncertain' });
        ctx.repo.event('reconcile_unresolved', { batchId: batch.id, jobId: job.id, attemptId: attempt.id }, { action: input.action, error: err.toJSON().error });
      });
      afterChange(ctx, batch.id, 'reconcile');
      return {
        ...base(ctx, mustBatch(ctx, batch.id)),
        job: job.seq,
        state: 'uncertain',
        missing: err.message,
        options: [
          'adopt with artifact_path if you know where the generated image is',
          'confirm_failed if no image was produced',
          'authorize_retry to generate this job again (only if the user accepts a possible duplicate)',
        ],
      };
    }
    ctx.db.transaction(() => {
      const fresh = ctx.repo.getAttempt(attempt.id)!;
      if (fresh.state !== 'claimed' && fresh.state !== 'uncertain') throw new IdraError('ATTEMPT_ALREADY_RESOLVED', `attempt is ${fresh.state}`);
      recordCompletionLocked(ctx, batch, mustJob(ctx, batch.id, job.id), fresh, prep, { via: `reconcile_${input.action}`, note: input.note ?? null, accept_duplicate: input.accept_duplicate === true }, undefined);
    });
    afterChange(ctx, batch.id, 'reconcile');
    return { ...base(ctx, mustBatch(ctx, batch.id)), job: job.seq, state: 'completed', file: path.basename(prep.finalPath), next: 'Call idra_step to continue.' };
  }

  ctx.db.transaction(() => {
    const now = nowIso();
    if (input.action === 'confirm_failed') {
      const err = { classification: 'confirmed_failure', message: (input.note ?? 'confirmed no image was produced').slice(0, 1000), retryable: true, at: now };
      ctx.repo.updateAttempt(attempt.id, { state: 'failed', resolved_at: now, error_json: JSON.stringify(err), evidence_json: JSON.stringify({ decision: 'confirm_failed', note: input.note ?? null }) });
      ctx.repo.updateJob(job.id, { state: 'failed', active_attempt_id: null, last_error_json: JSON.stringify(err) });
    } else {
      ctx.repo.updateAttempt(attempt.id, {
        state: 'superseded',
        resolved_at: now,
        evidence_json: JSON.stringify({ decision: 'new attempt authorized despite uncertain prior outcome', note: input.note ?? null }),
      });
      ctx.repo.updateJob(job.id, { state: 'pending', active_attempt_id: null, next_eligible_at: null });
    }
    ctx.repo.event(`reconcile_${input.action}`, { batchId: batch.id, jobId: job.id, attemptId: attempt.id }, { note: input.note ?? null });
    clearUncertainPause(ctx, batch.id);
  });
  afterChange(ctx, batch.id, 'reconcile');
  const b = mustBatch(ctx, batch.id);
  return { ...base(ctx, b), job: job.seq, state: mustJob(ctx, b.id, job.id).state, paused: b.paused === 1, next: 'Call idra_step to continue.' };
}

// ---------------------------------------------------------------- status

export interface StatusInput {
  batch_id?: string | undefined;
  detail?: boolean | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
}

export function batchState(ctx: Ctx, b: BatchRow): string {
  if (b.status === 'cancelled') return 'cancelled';
  if (b.paused) return `paused:${b.pause_reason ?? 'user'}`;
  const c = ctx.repo.counts(b.id, nowIso());
  if (c.claimed > 0) return 'in_progress';
  if (c.uncertain > 0) return 'needs_reconcile';
  if (c.pending + c.cooling > 0) return c.completed > 0 ? 'resumable' : 'not_started';
  if (c.failed > 0) return 'exhausted_with_errors';
  return 'done';
}

export function status(ctx: Ctx, input: StatusInput): Record<string, unknown> {
  if (!input.batch_id) {
    const list = ctx.repo.listBatches(20).map((b) => {
      const c = ctx.repo.counts(b.id, nowIso());
      return { batch_id: b.id, slug: b.slug, progress: `${c.completed}/${c.requested}`, state: batchState(ctx, b), created_at: b.created_at };
    });
    return { batches: list };
  }
  const b = mustBatch(ctx, input.batch_id);
  const c = ctx.repo.counts(b.id, nowIso());
  const refs = ctx.repo.listReferences(b.id);
  const jobs = ctx.repo.allJobs(b.id);
  const active = jobs.find((j) => j.state === 'claimed');
  const activeAtt = active?.active_attempt_id ? ctx.repo.getAttempt(active.active_attempt_id) : undefined;
  const problems = jobs.filter((j) => j.state === 'failed' || j.state === 'uncertain').slice(0, 10);
  const state = batchState(ctx, b);
  const out: Record<string, unknown> = {
    batch_id: b.id,
    handle: `idra://batch/${b.id}`,
    slug: b.slug,
    state,
    progress: `${c.completed}/${c.requested}`,
    counts: compactCounts(c),
    output_dir: b.output_dir,
    ...(activeAtt && active ? { active: { seq: active.seq, job_id: active.id, claimed_at: activeAtt.claimed_at, stale: Date.now() - Date.parse(activeAtt.claimed_at) > ctx.staleClaimMs } } : {}),
    ...(problems.length
      ? {
          problems: problems.map((j) => ({
            seq: j.seq,
            job_id: j.id,
            state: j.state,
            error: j.last_error_json ? (JSON.parse(j.last_error_json) as { classification?: string }).classification : undefined,
          })),
        }
      : {}),
    card: resumeCard(b, c, refs, state),
  };
  if (input.detail) {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const page = ctx.repo.listJobs(b.id, offset, limit);
    const arts = new Map(ctx.repo.listArtifacts(b.id).map((a) => [a.job_id, a]));
    out['jobs'] = page.map((j) => ({
      seq: j.seq,
      job_id: j.id,
      state: j.state,
      concept: j.concept.length > 80 ? `${j.concept.slice(0, 77)}...` : j.concept,
      ...(arts.get(j.id) ? { file: path.basename(arts.get(j.id)!.final_path) } : {}),
    }));
    if (offset + page.length < jobs.length) out['next_offset'] = offset + page.length;
  }
  return out;
}

/** A size-bounded orientation card for a host that lost its context. Not a substitute for job prompts. */
function resumeCard(b: BatchRow, c: Counts, refs: ReferenceRow[], state: string): string {
  const brief = (b.base_prompt ?? b.request_text).replace(/\s+/g, ' ');
  const refText = refs.length ? refs.map((r) => `${r.label} (${r.role})`).join(', ') : 'none';
  const nextHint =
    state === 'done'
      ? 'nothing left'
      : state.startsWith('paused')
        ? 'wait for the user to resume'
        : state === 'needs_reconcile' || state === 'in_progress'
          ? 'reconcile the open job'
          : 'call idra_step';
  const card = `${b.slug}: ${c.completed}/${c.requested} saved, ${state}. Mode ${b.planning_mode}. Brief: ${brief.slice(0, 220)}${brief.length > 220 ? '...' : ''} Refs: ${refText}. Aspect: ${b.target_aspect ?? 'any'}. Next: ${nextHint}.`;
  return card.slice(0, 600);
}

import type { Db } from './db.js';
import { nowIso } from '../core/ids.js';

export type BatchStatus = 'active' | 'cancelled';
export type JobState = 'pending' | 'claimed' | 'completed' | 'failed' | 'uncertain' | 'cancelled';
export type AttemptState = 'claimed' | 'completed' | 'failed' | 'uncertain' | 'superseded';
export type ReferenceRole = 'product' | 'person' | 'composition' | 'style' | 'edit_target' | 'design';

export interface BatchRow {
  id: string;
  slug: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  request_text: string;
  planning_mode: 'diversified' | 'variations' | 'explicit';
  base_prompt: string | null;
  requested_count: number;
  constraints_json: string;
  target_aspect: string | null;
  status: BatchStatus;
  paused: number;
  pause_reason: string | null;
  output_dir: string;
  max_retries: number;
  simulated: number;
  variety: 'subtle' | 'balanced' | 'bold';
}

export interface ReferenceRow {
  id: string;
  batch_id: string;
  /** null = applies to every job in the batch; set = this job only. */
  job_id: string | null;
  role: ReferenceRole;
  label: string;
  original_path: string;
  stored_path: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
  created_at: string;
}

export interface JobRow {
  id: string;
  batch_id: string;
  seq: number;
  concept: string;
  normalized_concept: string;
  prompt: string;
  state: JobState;
  attempts_count: number;
  retries_used: number;
  next_eligible_at: string | null;
  active_attempt_id: string | null;
  duplicate_of_seq: number | null;
  last_error_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttemptRow {
  id: string;
  job_id: string;
  batch_id: string;
  n: number;
  token: string;
  state: AttemptState;
  staging_dir: string;
  claimed_at: string;
  resolved_at: string | null;
  error_json: string | null;
  evidence_json: string | null;
  artifact_sha256: string | null;
}

export interface ArtifactRow {
  id: string;
  job_id: string;
  attempt_id: string;
  batch_id: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
  final_path: string;
  staging_path: string;
  requested_aspect: string | null;
  actual_aspect: string;
  aspect_matches: number | null;
  review_json: string | null;
  created_at: string;
}

export interface Counts {
  requested: number;
  completed: number;
  pending: number;
  cooling: number;
  claimed: number;
  failed: number;
  uncertain: number;
  cancelled: number;
}

export class Repo {
  constructor(private readonly db: Db) {}

  // ---- batches ----
  insertBatch(b: BatchRow): void {
    this.db.run(
      `INSERT INTO batches (id, slug, idempotency_key, created_at, updated_at, request_text, planning_mode, base_prompt, requested_count,
        constraints_json, target_aspect, status, paused, pause_reason, output_dir, max_retries, simulated, variety)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id,
        b.slug,
        b.idempotency_key,
        b.created_at,
        b.updated_at,
        b.request_text,
        b.planning_mode,
        b.base_prompt,
        b.requested_count,
        b.constraints_json,
        b.target_aspect,
        b.status,
        b.paused,
        b.pause_reason,
        b.output_dir,
        b.max_retries,
        b.simulated,
        b.variety,
      ],
    );
  }

  getBatch(id: string): BatchRow | undefined {
    return this.db.get<BatchRow>('SELECT * FROM batches WHERE id = ?', [id]);
  }

  getBatchByKey(key: string): BatchRow | undefined {
    return this.db.get<BatchRow>('SELECT * FROM batches WHERE idempotency_key = ?', [key]);
  }

  slugExists(slug: string): boolean {
    return !!this.db.get('SELECT 1 AS x FROM batches WHERE slug = ?', [slug]);
  }

  listBatches(limit = 50): BatchRow[] {
    return this.db.all<BatchRow>('SELECT * FROM batches ORDER BY created_at DESC LIMIT ?', [limit]);
  }

  updateBatch(id: string, fields: Partial<Pick<BatchRow, 'status' | 'paused' | 'pause_reason' | 'requested_count'>>): void {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = ?`);
      params.push(v as string | number | null);
    }
    sets.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);
    this.db.run(`UPDATE batches SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  // ---- references ----
  insertReference(r: ReferenceRow): void {
    this.db.run(
      `INSERT INTO batch_references (id, batch_id, job_id, role, label, original_path, stored_path, sha256, bytes, width, height, format, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.batch_id, r.job_id, r.role, r.label, r.original_path, r.stored_path, r.sha256, r.bytes, r.width, r.height, r.format, r.created_at],
    );
  }

  listReferences(batchId: string): ReferenceRow[] {
    return this.db.all<ReferenceRow>('SELECT * FROM batch_references WHERE batch_id = ? ORDER BY created_at, id', [batchId]);
  }

  /** Batch-wide references first, then the ones for this job only. */
  refsForJob(batchId: string, jobId: string): ReferenceRow[] {
    return this.db.all<ReferenceRow>(
      'SELECT * FROM batch_references WHERE batch_id = ? AND (job_id IS NULL OR job_id = ?) ORDER BY job_id IS NOT NULL, created_at, id',
      [batchId, jobId],
    );
  }

  batchWideRefs(batchId: string): ReferenceRow[] {
    return this.db.all<ReferenceRow>('SELECT * FROM batch_references WHERE batch_id = ? AND job_id IS NULL ORDER BY created_at, id', [batchId]);
  }

  // ---- jobs ----
  insertJob(j: JobRow): void {
    this.db.run(
      `INSERT INTO jobs (id, batch_id, seq, concept, normalized_concept, prompt, state, attempts_count, retries_used, next_eligible_at,
        active_attempt_id, duplicate_of_seq, last_error_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        j.id,
        j.batch_id,
        j.seq,
        j.concept,
        j.normalized_concept,
        j.prompt,
        j.state,
        j.attempts_count,
        j.retries_used,
        j.next_eligible_at,
        j.active_attempt_id,
        j.duplicate_of_seq,
        j.last_error_json,
        j.created_at,
        j.updated_at,
      ],
    );
  }

  getJob(id: string): JobRow | undefined {
    return this.db.get<JobRow>('SELECT * FROM jobs WHERE id = ?', [id]);
  }

  listJobs(batchId: string, offset = 0, limit = 50): JobRow[] {
    return this.db.all<JobRow>('SELECT * FROM jobs WHERE batch_id = ? ORDER BY seq LIMIT ? OFFSET ?', [batchId, limit, offset]);
  }

  allJobs(batchId: string): JobRow[] {
    return this.db.all<JobRow>('SELECT * FROM jobs WHERE batch_id = ? ORDER BY seq', [batchId]);
  }

  maxSeq(batchId: string): number {
    const r = this.db.get<{ m: number | null }>('SELECT MAX(seq) AS m FROM jobs WHERE batch_id = ?', [batchId]);
    return r?.m ?? 0;
  }

  claimedJob(batchId: string): JobRow | undefined {
    return this.db.get<JobRow>("SELECT * FROM jobs WHERE batch_id = ? AND state = 'claimed' ORDER BY seq LIMIT 1", [batchId]);
  }

  nextEligibleJob(batchId: string, now: string): JobRow | undefined {
    return this.db.get<JobRow>(
      "SELECT * FROM jobs WHERE batch_id = ? AND state = 'pending' AND (next_eligible_at IS NULL OR next_eligible_at <= ?) ORDER BY seq LIMIT 1",
      [batchId, now],
    );
  }

  earliestCooldown(batchId: string, now: string): string | undefined {
    const r = this.db.get<{ t: string | null }>("SELECT MIN(next_eligible_at) AS t FROM jobs WHERE batch_id = ? AND state = 'pending' AND next_eligible_at > ?", [
      batchId,
      now,
    ]);
    return r?.t ?? undefined;
  }

  updateJob(
    id: string,
    fields: Partial<Pick<JobRow, 'state' | 'attempts_count' | 'retries_used' | 'next_eligible_at' | 'active_attempt_id' | 'last_error_json' | 'duplicate_of_seq'>>,
  ): void {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = ?`);
      params.push(v as string | number | null);
    }
    sets.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);
    this.db.run(`UPDATE jobs SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  cancelPendingJobs(batchId: string): number {
    const r = this.db.run("UPDATE jobs SET state = 'cancelled', updated_at = ? WHERE batch_id = ? AND state = 'pending'", [nowIso(), batchId]);
    return Number(r.changes);
  }

  counts(batchId: string, now: string): Counts {
    const rows = this.db.all<{ state: JobState; cooling: number; n: number }>(
      `SELECT state, CASE WHEN state = 'pending' AND next_eligible_at IS NOT NULL AND next_eligible_at > ? THEN 1 ELSE 0 END AS cooling, COUNT(*) AS n
       FROM jobs WHERE batch_id = ? GROUP BY state, cooling`,
      [now, batchId],
    );
    const c: Counts = { requested: 0, completed: 0, pending: 0, cooling: 0, claimed: 0, failed: 0, uncertain: 0, cancelled: 0 };
    for (const r of rows) {
      const n = Number(r.n);
      c.requested += n;
      if (r.state === 'pending') {
        if (Number(r.cooling) === 1) c.cooling += n;
        else c.pending += n;
      } else {
        c[r.state] += n;
      }
    }
    return c;
  }

  // ---- attempts ----
  insertAttempt(a: AttemptRow): void {
    this.db.run(
      `INSERT INTO attempts (id, job_id, batch_id, n, token, state, staging_dir, claimed_at, resolved_at, error_json, evidence_json, artifact_sha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.job_id, a.batch_id, a.n, a.token, a.state, a.staging_dir, a.claimed_at, a.resolved_at, a.error_json, a.evidence_json, a.artifact_sha256],
    );
  }

  getAttempt(id: string): AttemptRow | undefined {
    return this.db.get<AttemptRow>('SELECT * FROM attempts WHERE id = ?', [id]);
  }

  getAttemptByToken(token: string): AttemptRow | undefined {
    return this.db.get<AttemptRow>('SELECT * FROM attempts WHERE token = ?', [token]);
  }

  listAttempts(jobId: string): AttemptRow[] {
    return this.db.all<AttemptRow>('SELECT * FROM attempts WHERE job_id = ? ORDER BY n', [jobId]);
  }

  updateAttempt(id: string, fields: Partial<Pick<AttemptRow, 'state' | 'resolved_at' | 'error_json' | 'evidence_json' | 'artifact_sha256'>>): void {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = ?`);
      params.push(v as string | number | null);
    }
    params.push(id);
    this.db.run(`UPDATE attempts SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  // ---- artifacts ----
  insertArtifact(a: ArtifactRow): void {
    this.db.run(
      `INSERT INTO artifacts (id, job_id, attempt_id, batch_id, sha256, bytes, width, height, format, final_path, staging_path, requested_aspect, actual_aspect, aspect_matches, review_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.id,
        a.job_id,
        a.attempt_id,
        a.batch_id,
        a.sha256,
        a.bytes,
        a.width,
        a.height,
        a.format,
        a.final_path,
        a.staging_path,
        a.requested_aspect,
        a.actual_aspect,
        a.aspect_matches,
        a.review_json,
        a.created_at,
      ],
    );
  }

  getArtifactByJob(jobId: string): ArtifactRow | undefined {
    return this.db.get<ArtifactRow>('SELECT * FROM artifacts WHERE job_id = ?', [jobId]);
  }

  artifactsBySha(batchId: string, sha256: string): ArtifactRow[] {
    return this.db.all<ArtifactRow>('SELECT * FROM artifacts WHERE batch_id = ? AND sha256 = ?', [batchId, sha256]);
  }

  listArtifacts(batchId: string): ArtifactRow[] {
    return this.db.all<ArtifactRow>('SELECT * FROM artifacts WHERE batch_id = ? ORDER BY created_at', [batchId]);
  }

  // ---- operations (idempotency) ----
  getOperation(key: string): { tool: string; request_hash: string; response_json: string } | undefined {
    return this.db.get('SELECT tool, request_hash, response_json FROM operations WHERE key = ?', [key]);
  }

  putOperation(key: string, tool: string, requestHash: string, response: unknown): void {
    this.db.run('INSERT INTO operations (key, tool, request_hash, response_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO NOTHING', [
      key,
      tool,
      requestHash,
      JSON.stringify(response),
      nowIso(),
    ]);
  }

  // ---- events ----
  event(kind: string, ids: { batchId?: string | null; jobId?: string | null; attemptId?: string | null }, detail: unknown = null): void {
    this.db.run('INSERT INTO events (batch_id, job_id, attempt_id, kind, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      ids.batchId ?? null,
      ids.jobId ?? null,
      ids.attemptId ?? null,
      kind,
      detail === null ? null : JSON.stringify(detail),
      nowIso(),
    ]);
  }

  listEvents(batchId: string, limit = 200): { id: number; kind: string; job_id: string | null; attempt_id: string | null; detail_json: string | null; created_at: string }[] {
    return this.db.all('SELECT id, kind, job_id, attempt_id, detail_json, created_at FROM events WHERE batch_id = ? ORDER BY id DESC LIMIT ?', [batchId, limit]);
  }

  countEvents(kind: string): number {
    const r = this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM events WHERE kind = ?', [kind]);
    return Number(r?.n ?? 0);
  }
}

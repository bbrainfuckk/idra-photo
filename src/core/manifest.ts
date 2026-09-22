import path from 'node:path';
import type { Ctx } from './context.js';
import { nowIso } from './ids.js';
import { atomicWriteFile } from '../artifacts/paths.js';

/** Rebuildable export of one batch. The database stays the source of truth. */
export function buildManifest(ctx: Ctx, batchId: string): Record<string, unknown> | null {
  const b = ctx.repo.getBatch(batchId);
  if (!b) return null;
  const refs = ctx.repo.listReferences(batchId);
  const jobs = ctx.repo.allJobs(batchId);
  const artifacts = new Map(ctx.repo.listArtifacts(batchId).map((a) => [a.job_id, a]));
  const counts = ctx.repo.counts(batchId, nowIso());
  return {
    schema: 'idra.manifest.v1',
    exported_at: nowIso(),
    simulated: b.simulated === 1,
    batch: {
      id: b.id,
      slug: b.slug,
      created_at: b.created_at,
      request: b.request_text,
      planning_mode: b.planning_mode,
      base_prompt: b.base_prompt,
      target_aspect: b.target_aspect,
      constraints: JSON.parse(b.constraints_json),
      max_retries: b.max_retries,
      status: b.status,
      paused: b.paused === 1,
      pause_reason: b.pause_reason,
    },
    references: refs.map((r) => ({
      label: r.label,
      role: r.role,
      original_path: r.original_path,
      workspace_copy: path.relative(ctx.rootReal, r.stored_path),
      sha256: r.sha256,
      bytes: r.bytes,
      width: r.width,
      height: r.height,
      format: r.format,
    })),
    counts,
    jobs: jobs.map((j) => {
      const a = artifacts.get(j.id);
      return {
        seq: j.seq,
        concept: j.concept,
        prompt: j.prompt,
        state: j.state,
        attempts: j.attempts_count,
        duplicate_concept_of: j.duplicate_of_seq,
        error: j.last_error_json ? JSON.parse(j.last_error_json) : null,
        artifact: a
          ? {
              file: path.basename(a.final_path),
              sha256: a.sha256,
              bytes: a.bytes,
              width: a.width,
              height: a.height,
              format: a.format,
              requested_aspect: a.requested_aspect,
              actual_aspect: a.actual_aspect,
              aspect_matches: a.aspect_matches === null ? null : a.aspect_matches === 1,
              completed_at: a.created_at,
            }
          : null,
        visual_review: a?.review_json ? JSON.parse(a.review_json) : { performed: false },
      };
    }),
    notes: [
      'A valid file is not proof that the product, face, text, or style was preserved; see visual_review.',
      b.simulated === 1 ? 'SIMULATED batch: artifacts are generated fixture images, not native image-generation outputs.' : 'Artifacts were saved by the host agent from its own image tool.',
    ],
  };
}

export function writeManifest(ctx: Ctx, batchId: string): string | null {
  const m = buildManifest(ctx, batchId);
  const b = ctx.repo.getBatch(batchId);
  if (!m || !b) return null;
  const out = path.join(b.output_dir, 'manifest.json');
  atomicWriteFile(out, JSON.stringify(m, null, 2));
  return out;
}

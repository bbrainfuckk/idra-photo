import fs from 'node:fs';
import path from 'node:path';
import { IdraError } from './errors.js';
import { newId, nowIso, sha256Hex, slugify } from './ids.js';
import type { Ctx } from './context.js';
import type { ReferenceRole, ReferenceRow } from '../storage/repo.js';
import { validateImageFile } from '../artifacts/validate.js';
import { ensureDir, resolveWithin } from '../artifacts/paths.js';

export interface ReferenceInput {
  path: string;
  role: ReferenceRole;
  label?: string | undefined;
}

/**
 * Validate a reference image and copy it into the workspace. The original is never modified.
 * Only the workspace and explicitly authorized import folders are readable.
 */
export function importReference(ctx: Ctx, batchId: string, ref: ReferenceInput, index: number): ReferenceRow {
  let real: string;
  try {
    real = resolveWithin([ctx.rootReal, ...ctx.allowImportsReal], ref.path);
  } catch (err) {
    if (err instanceof IdraError && err.code === 'PATH_OUTSIDE_WORKSPACE') {
      throw new IdraError('REFERENCE_INVALID', 'reference image is outside the folders Idra may read; copy it into the workspace references/ folder', {
        path: ref.path,
        workspace_references: path.join(ctx.rootReal, 'references'),
      });
    }
    throw err;
  }
  let info;
  try {
    info = validateImageFile(real, ctx.limits.image);
  } catch (err) {
    throw new IdraError('REFERENCE_INVALID', `reference is not a readable PNG, JPEG, or WebP image: ${ref.path}`, {
      path: ref.path,
      cause: err instanceof IdraError ? err.details : String(err),
    });
  }
  const label = (ref.label && ref.label.trim()) || path.basename(real, path.extname(real));
  const dir = path.join(ctx.referencesRoot, batchId);
  ensureDir(dir);
  const stored = path.join(dir, `${String(index + 1).padStart(2, '0')}-${slugify(label, 32)}.${info.extension}`);
  fs.copyFileSync(real, stored);
  if (sha256Hex(fs.readFileSync(stored)) !== info.sha256) {
    throw new IdraError('IO_ERROR', 'reference copy does not match the original checksum', { path: ref.path });
  }
  return {
    id: newId('ref'),
    batch_id: batchId,
    role: ref.role,
    label: label.slice(0, 80),
    original_path: real,
    stored_path: stored,
    sha256: info.sha256,
    bytes: info.bytes,
    width: info.width,
    height: info.height,
    format: info.format,
    created_at: nowIso(),
  };
}

/** Cheap availability check before each claim: the workspace copy must still exist unchanged in size. */
export function referenceAvailable(r: ReferenceRow): boolean {
  try {
    const st = fs.statSync(r.stored_path);
    return st.isFile() && st.size === Number(r.bytes);
  } catch {
    return false;
  }
}

import fs from 'node:fs';
import path from 'node:path';
import { IdraError } from '../core/errors.js';
import { padSeq, slugify, sha256Hex } from '../core/ids.js';
import { ensureDir } from './paths.js';

/** Attempt-specific staging directory: .idra/staging/<batch_id>/<seq>-a<attempt>/ */
export function stagingDirFor(stagingRoot: string, batchId: string, seq: number, attemptN: number): string {
  return path.join(stagingRoot, batchId, `${padSeq(seq)}-a${attemptN}`);
}

export function stagingSuggestedPath(stagingDir: string): string {
  return path.join(stagingDir, 'image.png');
}

export function finalArtifactPath(outputDir: string, seq: number, concept: string, ext: string): string {
  return path.join(outputDir, `${padSeq(seq)}-${slugify(concept, 32)}.${ext}`);
}

export interface FinalizeResult {
  finalPath: string;
  adoptedExisting: boolean;
}

/**
 * Copy the staged original into outputs without ever overwriting. If the final file already
 * exists with the same hash (crash after copy, before commit) it is adopted; a different hash
 * is a conflict that must be reconciled by a human.
 */
export function finalizeArtifact(stagingPath: string, finalPath: string, expectedSha256: string, orphanDir: string | null = null): FinalizeResult {
  ensureDir(path.dirname(finalPath));
  if (fs.existsSync(finalPath)) {
    const existing = sha256Hex(fs.readFileSync(finalPath));
    if (existing === expectedSha256) return { finalPath, adoptedExisting: true };
    if (!orphanDir) {
      throw new IdraError('ARTIFACT_CONFLICT', 'a different file already exists at the final artifact path', {
        final_path: finalPath,
        existing_sha256: existing,
        reported_sha256: expectedSha256,
      });
    }
    // An unrecorded leftover from an interrupted finalization: keep it, never overwrite it.
    ensureDir(orphanDir);
    fs.renameSync(finalPath, path.join(orphanDir, `${Date.now()}-${path.basename(finalPath)}`));
  }
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.part`;
  fs.copyFileSync(stagingPath, tmp, fs.constants.COPYFILE_EXCL);
  const fd = fs.openSync(tmp, 'r+');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, finalPath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
  return { finalPath, adoptedExisting: false };
}

/** Look for a candidate artifact inside an attempt's staging directory (crash recovery). */
export function findStagedCandidate(stagingDir: string): string | null {
  if (!fs.existsSync(stagingDir)) return null;
  const entries = fs
    .readdirSync(stagingDir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.endsWith('.part') && !e.name.endsWith('.tmp') && /\.(png|jpg|jpeg|webp)$/i.test(e.name))
    .map((e) => e.name)
    .sort();
  if (entries.length === 0) return null;
  return path.join(stagingDir, entries[0]!);
}

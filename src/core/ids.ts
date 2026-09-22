import { createHash, randomBytes } from 'node:crypto';

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString('hex')}`;
}

/** Attempt tokens are unguessable and unique per claim. */
export function newToken(): string {
  return randomBytes(16).toString('hex');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoPlusSeconds(seconds: number, from = Date.now()): string {
  return new Date(from + seconds * 1000).toISOString();
}

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Deterministic hash of a JSON value with sorted keys, used for idempotency conflict checks. */
export function stableHash(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Lowercase, ASCII-only, hyphen-separated slug bounded in length. Never empty. */
export function slugify(input: string, max = 40): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return base.length > 0 ? base : 'item';
}

export function padSeq(seq: number): string {
  return String(seq).padStart(3, '0');
}

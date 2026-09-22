/** Stable error codes returned by every tool and CLI command. */
export type ErrorCode =
  | 'INVALID_INPUT'
  | 'BATCH_NOT_FOUND'
  | 'JOB_NOT_FOUND'
  | 'ATTEMPT_NOT_FOUND'
  | 'ATTEMPT_TOKEN_MISMATCH'
  | 'ATTEMPT_ALREADY_RESOLVED'
  | 'ATTEMPT_ALREADY_COMPLETED'
  | 'JOB_STATE_INVALID'
  | 'BATCH_CANCELLED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PATH_OUTSIDE_WORKSPACE'
  | 'PATH_UNSAFE'
  | 'ARTIFACT_INVALID'
  | 'ARTIFACT_NOT_IN_STAGING'
  | 'ARTIFACT_CONFLICT'
  | 'REFERENCE_INVALID'
  | 'CONSTRAINT_CONFLICT'
  | 'PLAN_INVALID'
  | 'CONFIRMATION_REQUIRED'
  | 'IO_ERROR'
  | 'INTERNAL';

export class IdraError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'IdraError';
    this.code = code;
    this.details = details;
  }

  toJSON(): { error: { code: ErrorCode; message: string; details: Record<string, unknown> } } {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

export function isIdraError(err: unknown): err is IdraError {
  return err instanceof IdraError;
}

export function toErrorPayload(err: unknown): { error: { code: ErrorCode; message: string; details: Record<string, unknown> } } {
  if (isIdraError(err)) return err.toJSON();
  const message = err instanceof Error ? err.message : String(err);
  return { error: { code: 'INTERNAL', message, details: {} } };
}

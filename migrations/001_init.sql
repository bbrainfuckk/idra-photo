-- Idra Photo schema v1. The database is the source of truth; manifests are exports.
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  request_text TEXT NOT NULL,
  planning_mode TEXT NOT NULL CHECK (planning_mode IN ('diversified','variations','explicit')),
  base_prompt TEXT,
  requested_count INTEGER NOT NULL,
  constraints_json TEXT NOT NULL,
  target_aspect TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','cancelled')),
  paused INTEGER NOT NULL DEFAULT 0,
  pause_reason TEXT,
  output_dir TEXT NOT NULL,
  max_retries INTEGER NOT NULL DEFAULT 2,
  simulated INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS batch_references (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  role TEXT NOT NULL CHECK (role IN ('product','person','composition','style','edit_target')),
  label TEXT NOT NULL,
  original_path TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  format TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS batch_references_batch ON batch_references(batch_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  seq INTEGER NOT NULL,
  concept TEXT NOT NULL,
  normalized_concept TEXT NOT NULL,
  prompt TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending','claimed','completed','failed','uncertain','cancelled')),
  attempts_count INTEGER NOT NULL DEFAULT 0,
  retries_used INTEGER NOT NULL DEFAULT 0,
  next_eligible_at TEXT,
  active_attempt_id TEXT,
  duplicate_of_seq INTEGER,
  last_error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (batch_id, seq)
);
CREATE INDEX IF NOT EXISTS jobs_batch_state ON jobs(batch_id, state);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  batch_id TEXT NOT NULL REFERENCES batches(id),
  n INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('claimed','completed','failed','uncertain','superseded')),
  staging_dir TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  resolved_at TEXT,
  error_json TEXT,
  evidence_json TEXT,
  artifact_sha256 TEXT
);
CREATE INDEX IF NOT EXISTS attempts_job ON attempts(job_id);
CREATE INDEX IF NOT EXISTS attempts_batch_state ON attempts(batch_id, state);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id),
  attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id),
  batch_id TEXT NOT NULL REFERENCES batches(id),
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  format TEXT NOT NULL,
  final_path TEXT NOT NULL UNIQUE,
  staging_path TEXT NOT NULL,
  requested_aspect TEXT,
  actual_aspect TEXT NOT NULL,
  aspect_matches INTEGER,
  review_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS artifacts_batch_sha ON artifacts(batch_id, sha256);

CREATE TABLE IF NOT EXISTS operations (
  key TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT,
  job_id TEXT,
  attempt_id TEXT,
  kind TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_batch ON events(batch_id, id);

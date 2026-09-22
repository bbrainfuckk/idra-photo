# Architecture

Idra is a local stdio MCP server plus a SQLite file. The host agent (Codex) does all generation. Idra decides *which* job is next and records *what was actually saved*.

```
Codex agent ── stdio MCP ──> idra-photo serve --workspace <dir>
   │                              │
   │ image_gen (host-owned)       ├─ .idra/state.sqlite   source of truth
   │                              ├─ .idra/references/    validated copies of inputs
   └─ saves file ───────────────> ├─ .idra/staging/<batch>/<seq>-a<attempt>/
                                  └─ outputs/<batch>/NNN-name.png + manifest.json
```

## The loop

1. `idra_create_batch` stores the request, references (validated, hashed, copied), constraints, and one row per job with its fully assembled prompt.
2. `idra_step` without `completed` claims one job in a `BEGIN IMMEDIATE` transaction and returns it: prompt, reference paths, aspect, `save_to`, and an attempt token.
3. Codex generates with its own tool and either copies the file to `save_to` or passes its path as `artifact_path`. Only authorized folders are accepted.
4. `idra_step` with `completed` validates the image, copies it to `outputs/` without overwriting, commits the completion, and claims the next job. All of that happens in one exchange.

No call blocks while an image is being made. Waiting is stored state, not a request that stays open.

## Modules

| Path | Job |
|---|---|
| `src/server.ts`, `src/tools/` | MCP wiring, schemas, annotations |
| `src/instructions.ts` | Server instructions. The first 512 characters are self-contained. |
| `src/core/queue.ts` | Claims, completion, retries, control, extend, reconcile, status |
| `src/core/planning.ts`, `prompt.ts`, `constraints.ts` | Modes, duplicate flags, per-job prompts |
| `src/core/references.ts` | Reference import and availability checks |
| `src/artifacts/` | Path safety, image validation, staging and finalization |
| `src/storage/` | SQLite via `node:sqlite` with no native addon, plus migrations |
| `src/sim/` | Fake host and fixture images (simulation only) |

## State and counts

Job states are `pending`, `claimed`, `completed`, `failed`, `uncertain`, and `cancelled`. Pause is a batch flag, separate from job state. Counts are one `GROUP BY` over jobs, so they always add up to `requested`. Pending jobs in a retry cooldown are reported as `cooling`.

## Duplicate-resistant, not exactly-once

The host's image tool and Idra's database cannot share a transaction. Idra delivers:

- **One active job per batch.** A second step while a job is claimed returns `blocked: job_in_progress`, never a second claim. This is serialized across processes by SQLite's write lock.
- **Idempotent bookkeeping.** A completion is keyed by its attempt token. Repeating it replays the stored reply. A different file for a completed job is refused. Create and extend need idempotency keys.
- **Crash-safe finalization.** The staged original is copied to a deterministic final name through a temp file and a rename. On retry, a same-hash file is adopted. An unrecorded different file is moved to `.idra/orphans/`, never overwritten.
- **Explicit uncertainty.** A claim older than the stale window (20 min by default) becomes `uncertain` and pauses the batch. `idra_reconcile` then adopts a valid file from that attempt's staging folder, records a confirmed failure, or with explicit authorization opens a new attempt. Nothing is regenerated automatically.

## Failures

`idra_report_problem` classifies failures. `transient` and `invalid_output` retry at most twice by default, with persisted `next_eligible_at` timestamps. `usage_limit`, `tool_unavailable`, and `permission_denied` pause the batch and keep the job pending. `safety_refusal` fails the job, pauses the batch, and is never retried or reworded. `unknown` pauses the batch.

## Low overhead by design

- One tool call per image in the normal path.
- Replies carry only the current job and compact counts, never the plan, history, or image bytes.
- A batch is referred to by an `idra://batch/<id>` handle. `idra_status` returns a resume card of at most 600 characters for a host that lost context. The card orients the host only. Each job's prompt still carries every rule it needs.


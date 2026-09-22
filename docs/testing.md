# Testing

No test needs model credentials or image usage. Run everything:

```bash
npm test
```

## Categories

| Category | Where | What it proves |
|---|---|---|
| Unit | `tests/unit/validate.test.ts`, `planning.test.ts` | Image decoding and limits, planning modes, duplicate flags, prompt and constraint assembly |
| Queue and recovery | `tests/unit/queue.test.ts` | Claims, idempotency, the combined step, conflicts, retries, pause/resume/cancel, extend, reconcile, crash points, path security, manifests, migrations |
| MCP integration | `tests/integration/mcp.test.ts` | Protocol-clean stdout, 7 annotated tools, the 100-job run over stdio, a killed-and-resumed process, concurrent processes, no network, no API clients |
| Packaging | `npm run pack:check` | Installs from the packed tarball and runs `doctor` and `simulate` from the installed copy |
| Overhead | `npm run overhead` | Bytes and calls, see `overhead.md` |
| Real native generation | manual, below | Not automated, because it uses real image generation |

A simulated 100-job success proves queue behavior. It does not prove 100 real generations.

## Real smoke test: 3 images (needs your OK, uses your Codex plan)

1. `node dist/src/cli.js install-codex --workspace "<a test folder>"` and restart Codex.
2. Put any product photo in that folder's `references/`.
3. In Codex, write: *Use Idra Photo. Make 3 photos in the same style as references/product.png: the product on a bathroom shelf. 4:5.*
4. Record:
   - Did Codex call `idra_create_batch` with the reference and `style: strict`?
   - Did it `view_image` the reference before generating?
   - How did it report each file: an `artifact_path` from `generated_images`, or a copy to `save_to`?
   - Did it continue to images 2 and 3 on its own, or did you have to say "continue"? This is the key open question.
   - `outputs/<batch>/` holds 3 files, and `manifest.json` shows 3 completed with distinct hashes.
5. Put the answers in `docs/compatibility.md`.

## 10-image interruption procedure

1. Start a 10-image batch as above.
2. After about 4 images are saved, close Codex completely.
3. Reopen Codex and say *resume my Idra batch*.
4. Expect `idra_status`, then `idra_reconcile check` for any open job, then a continuation from the next number. The interrupted image must be adopted if it was saved to `save_to`, and never made twice.
5. Verify `manifest.json` shows 10 completed and every `attempts` value is 1, except jobs you explicitly authorized to retry.

## 100-image endurance procedure (never run automatically)

Run only with explicit owner authorization and a plan that can absorb it. Use the same steps with 100. Record wall time, the number of times you had to say "continue", any `usage_limit` pauses and when they cleared, and the final counts. Do not infer a daily allowance from the result.

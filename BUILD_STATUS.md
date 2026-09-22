# Build status

Updated 2026-09-22. Three separate deliverables, three separate statuses:

| Deliverable | Status |
|---|---|
| Local MCP server, queue, recovery, install | **Working and tested** |
| Native Codex image loop (real `image_gen`) | **Not tested.** Idra was loaded and called by real Codex, and `image_gen` was reported available. No real image has been generated through Idra yet. |

## Milestones

- [x] A. Workspace inspected, runnable local stdio MCP
- [x] B. Persistent create, claim, combined complete-and-next step, status
- [x] C. Recovery, idempotency, cancellation, bounded retries, extension
- [x] D. References (roles, checksums, workspace copies), constraints including style, artifact validation, manifests
- [x] F. Automated tests, 100-job simulation, interruption recovery, overhead measurement
- [x] G. Packed-install test, Codex install verified on a throwaway config, smoke-test procedures written
- [x] I. Clone-and-install: prebuilt `idra-photo.mjs`, `install.cmd`/`install.sh`, launchers that find Node at every start, `uninstall-codex`
- [x] J. Installed into the owner's real Codex (2026-09-22); Codex started it through the launcher and called `idra_status`
- [ ] H. Real 3-image native smoke test (needs owner authorization for image usage)

## Commands actually run (Windows 11, Node 24.21.0)

| Command | Result |
|---|---|
| `tsc --noEmit` (strict) | 0 errors |
| `npm test` | 54 of 54 pass: 45 unit/queue, 9 integration (stdio, launcher, installer) |
| `npm run overhead` | 1.02 calls and 1,195 response bytes per image, vs 2.02 and 19,254 for the synthetic chatty baseline |
| `npm run clone:check` | Fresh clone, no npm install: install, doctor, simulate, and uninstall all exit 0 |
| `npm run pack:check` | Tarball installs cleanly into a new prefix; the installed `doctor` and `simulate --count 3` exit 0 |
| `install-codex` with a throwaway `CODEX_HOME` | Real `codex mcp add` succeeded; `codex mcp get idra_photo` shows the entry; the real `~/.codex/config.toml` is unchanged |
| `codex exec` (text only, `-c` overrides) | Codex launched Idra, delivered the instructions, and called `idra_status`; it reported `image_gen__imagegen` and `view_image` available; 12,909 tokens reported |

Lint: no separate linter is configured. Strict TypeScript is the static check.

## Open items

1. **Real smoke test.** Run the 3-image procedure in `docs/testing.md` after the owner OKs the usage. The key unknown is whether Codex continues from image to image in one turn or needs "continue".
2. Host the repo (for example a private GitHub repo) so teammates can clone it. Nothing has been pushed.
3. Delete the duplicate staged copy of each image after it is recorded. This halves disk use; about 0.9 MB per 1024x1280 image is duplicated now.
4. Run the macOS/Linux launcher on a real Mac (CI will cover it once hosted).

## Next action

Owner runs, or authorizes running, the 3-image smoke test. Then record the results in `docs/compatibility.md` and this file.

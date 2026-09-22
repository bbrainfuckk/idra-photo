# Build status

Updated 2026-09-22. Three separate deliverables, three separate statuses:

| Deliverable | Status |
|---|---|
| Local MCP server, queue, recovery, install | **Working and tested** |
| Native Codex image loop (real `image_gen`) | **Tested with 3 real images** (2026-09-22). One Codex turn, no "continue" needed, 3/3 saved and validated. Output variety is too low; see open items. |

## Milestones

- [x] A. Workspace inspected, runnable local stdio MCP
- [x] B. Persistent create, claim, combined complete-and-next step, status
- [x] C. Recovery, idempotency, cancellation, bounded retries, extension
- [x] D. References (roles, checksums, workspace copies), constraints including style, artifact validation, manifests
- [x] F. Automated tests, 100-job simulation, interruption recovery, overhead measurement
- [x] G. Packed-install test, Codex install verified on a throwaway config, smoke-test procedures written
- [x] I. Clone-and-install: prebuilt `idra-photo.mjs`, `install.cmd`/`install.sh`, launchers that find Node at every start, `uninstall-codex`
- [x] J. Installed into the owner's real Codex (2026-09-22); Codex started it through the launcher and called `idra_status`
- [x] H. Real 3-image native smoke test: passed as a loop. Details in `docs/compatibility.md`.

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

1. **Variety.** In the smoke test, all 3 images near-copied the style reference's sitter, pose, and background. Add a style-only guard for `style` references ("take the look, not the person or layout") and make variations vary pose and setting, then re-run the 3-image test.
2. Run the 10-image interruption procedure in `docs/testing.md` for real.
3. Host the repo (for example a private GitHub repo) so teammates can clone it. Nothing has been pushed.
4. Delete the duplicate staged copy of each image after it is recorded. Real images are about 2.4 MB, and each currently exists three times: Codex's copy, the staging copy, and the output.
5. Run the macOS/Linux launcher on a real Mac (CI will cover it once hosted).

## Next action

Fix variety (item 1), then re-run the 3-image smoke test with the same painting to compare.

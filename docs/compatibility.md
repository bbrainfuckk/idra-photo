# Compatibility

Recorded 2026-09-22 on Windows 11 Home Single Language 10.0.26200 (x64).

| Item | Value |
|---|---|
| Codex desktop app | 26.915.31945 (from the app's own config) |
| Codex CLI | `codex-cli 0.155.0-alpha.9.2` (bundled with the app under `%LOCALAPPDATA%\OpenAI\Codex\bin\`) |
| Model in the test session | `gpt-6-astra`, reasoning effort overridden to `low` |
| Node | 24.21.0 (the copy bundled with Codex). The minimum is 22.13, where `node:sqlite` needs no flag. |
| MCP SDK | `@modelcontextprotocol/sdk` 1.30.0 |

Levels of evidence used below: **documented** (official or bundled docs), **host-reported** (the running Codex said so), **tested** (we ran it end to end).

| Question | Level | Evidence |
|---|---|---|
| Local stdio MCP servers | documented + tested | Codex MCP docs describe `[mcp_servers.<name>]` with `command`, `args`, `env`, `cwd`, `startup_timeout_sec` (default 10), and `tool_timeout_sec` (default 60), plus `codex mcp add <name> -- <cmd>`. `idra-photo install-codex` ran the real `codex mcp add` against a throwaway `CODEX_HOME`, and `codex mcp get idra_photo` read the entry back. |
| Server instructions delivered | documented + tested | The docs say Codex reads the MCP `instructions` field and to keep the first 512 characters self-contained. In a `codex exec` session, the model quoted the first words of Idra's instructions. |
| Codex calls Idra tools | tested | The same `codex exec` session called `mcp__idra_photo__idra_status` and printed `{"batches":[]}`. The MCP call needed no approval prompt under `approval: never`. That session reported 12,909 tokens. |
| Clone-and-install flow | tested | A fresh `git clone` with no `npm install` ran `install-codex` through `idra-photo.cmd` against a throwaway `CODEX_HOME`. From the clone it then ran `doctor`, a simulated batch, and `uninstall-codex` (`npm run clone:check`). |
| Codex starts the `.cmd` launcher | tested | After a real install (`command = idra-photo.cmd`, `args = [serve]`, workspace passed by env), a `codex exec` session with no overrides called `idra_status` and got `{"batches":[]}`. |
| Native image tool in the session | host-reported | The model listed `image_gen__imagegen` and `view_image` as callable. Idra cannot verify this from its side. |
| Reference images | documented | Codex's bundled imagegen skill (`~/.codex/skills/.system/imagegen/SKILL.md`) says built-in edits use images visible in the conversation, and local files must first be loaded with `view_image`. Idra returns reference paths, and its instructions tell the agent to `view_image` them. |
| Dragged-in images have a path | observed | Local Codex session logs show attached images as `<image name=[Image #1] path="C:\Users\...\Downloads\X.jpg">`. The agent can therefore pass that path to `idra_create_batch`. |
| Where generated files go | documented + observed | The skill says outputs are saved under `$CODEX_HOME/generated_images/...` and says not to rely on a destination-path argument. Such files exist on this machine, e.g. `generated_images/<thread>/exec-<uuid>.png`. Idra accepts that folder through `--allow-import` and copies from it. It never searches it. |
| Tool calls continue after a generation | **tested** | In the 3-image smoke test, one `codex exec` turn ran all three generations with no "continue" from the user. |
| Full native loop (generate, save, report, next) | **tested, 3 images** | See "Smoke test, 2026-09-22" below. |
| Image tool signature | host-reported | The session's tool schema showed `image_gen__imagegen({ prompt, referenced_image_paths?, num_last_images_to_include? })`. Codex passed Idra's workspace copy of the reference in `referenced_image_paths`, so no `view_image` step was needed. |

## Smoke test, 2026-09-22 (real generation, authorized by the owner)

Command: `codex exec -s workspace-write -C "<workspace>" -c model_reasoning_effort="medium" "<prompt>" -i <painting.jpg>`. The installed `idra_photo` entry was used unchanged. The prompt asked for 3 photos in the exact style of an attached public-domain painting (Leonardo, *Ginevra de' Benci*): "a young woman holding a small amber glass skincare serum bottle near her collarbone", 4:5.

| Check | Result |
|---|---|
| Batch plan | `variations`, the user's prompt as `base_prompt`, the dragged-in image as a `style` reference, `style: strict` with details, `target_aspect: 4:5`. This matches the server instructions. |
| Tool calls | 1 `idra_create_batch` and 4 `idra_step` (one claim, then three complete-and-next). There were no status, reconcile, or problem calls. |
| Image tool input | Each of the 3 `image_gen` calls carried Idra's job prompt with the `STYLE (strict)` rule and the reference path. |
| How files were reported | `artifact_path` = `~/.codex/generated_images/<thread>/exec-<uuid>.png`. Idra copied each file into staging, validated it, and finalized it. |
| Outputs | 3 PNGs, 1122x1402 (4:5 within 1%), about 2.4 MB each, 3 distinct hashes, all first attempts, manifest 3/3 completed |
| Extra user turns | None: one turn, 202 s wall time |
| Host-reported tokens | 29,896 for the whole turn. This includes Codex reading its imagegen skill. Image-generation usage is billed separately by the host and was not reported. |
| Visual review | Codex recorded its own review as passed for all three. An independent look found an excellent style match but very little variety: all three reproduce the reference painting's sitter, pose, and background, with the bottle added. |

Finding: `variations` plus `style: strict` plus a reference passed straight to the image tool leads the model to near-copy the reference rather than make new images in its style. A style-only guard in the per-job prompt, or variation hints, is the next fix; see `BUILD_STATUS.md`.

## Not claimed

- Browser ChatGPT, other MCP clients, or remote/cloud Codex sessions. Idra needs the host and the server to share a local filesystem.
- Any daily image allowance or cost. Codex's own usage limits apply.

## Known integration notes

- The Codex-bundled Node path contains a hash that changes on updates. The launcher therefore looks for Node at every start: `IDRA_NODE_EXE`, then `node` on PATH, then the newest Codex-bundled Node. The config never stores a Node path.
- macOS and Linux launchers are written but not yet run on those systems. CI covers them once the repo is hosted.
- `codex mcp add` does not set `startup_timeout_sec`. Idra starts in well under the 10 s default.

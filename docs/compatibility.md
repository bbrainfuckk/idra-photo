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
| Tool calls continue after a generation | documented, **not tested** | The skill says to produce many variants "by issuing one `image_gen` call per requested asset". Whether one Codex turn keeps looping through Idra for N images is unverified. |
| Full native loop (generate, save, report, next) | **not tested** | This needs real image usage. It is ready to run as the 3-image smoke test in `docs/testing.md` once the owner authorizes it. |

## Not claimed

- Browser ChatGPT, other MCP clients, or remote/cloud Codex sessions. Idra needs the host and the server to share a local filesystem.
- Any daily image allowance or cost. Codex's own usage limits apply.

## Known integration notes

- The Codex-bundled Node path contains a hash that changes on updates. The launcher therefore looks for Node at every start: `IDRA_NODE_EXE`, then `node` on PATH, then the newest Codex-bundled Node. The config never stores a Node path.
- macOS and Linux launchers are written but not yet run on those systems. CI covers them once the repo is hosted.
- `codex mcp add` does not set `startup_timeout_sec`. Idra starts in well under the 10 s default.

# Security

Idra runs locally over stdio and treats every prompt, file name, and image as data.

- **File access** is limited to the workspace and the explicit `--allow-import` folders. Paths must be absolute. Symlinks are resolved before the check. Traversal, control characters, and the home directory or a filesystem root as workspace are refused.
- **Accepted files** are only PNG, JPEG, and WebP, within byte and pixel limits. PNG pixel limits are checked before decompression.
- **No credentials.** Idra never reads host login files and never asks for passwords, session tokens, or API keys.
- **No network.** There is no HTTP, socket, or DNS code, and a test runs the server with networking blocked.
- **No shell or URL tools** are exposed. SQL is parameterized. Inputs have bounded lengths.
- **Git hygiene.** `.idra/`, `outputs/`, and `references/` are ignored so images and state are not committed.

Report issues privately to the repository owner.

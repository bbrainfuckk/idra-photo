# Idra Photo

**Your AI generates. Idra manages the batch.**

Drag a photo into Codex, type one prompt, say how many images you want. Codex makes every image with its own built-in image tool. Idra hands Codex one job at a time, saves each finished image into a numbered folder, and remembers where the batch stopped so you can pick it up later.

- No image API key, no extra image service, no web dashboard.
- Everything Idra stores stays on your computer.
- Idra itself never generates images and never makes network requests. Codex still uses its own image service and your own Codex plan.

> Status: v0.1. The local MCP server, queue, recovery, and install are tested. A full real-image run in Codex has **not** been tested yet; see [Compatibility](docs/compatibility.md).

## Install (about a minute)

1. Get the folder: `git clone` this repository, or download the ZIP and unzip it anywhere.
2. **Windows:** double-click `install.cmd`. **macOS/Linux:** run `sh install.sh` in the folder.
3. Restart Codex.

That is all. No `npm install`: the server ships prebuilt as one file, `idra-photo.mjs`.

What the installer does:

- Creates `Idra Photo` in your home folder. Your images go to `Idra Photo/outputs/`.
- Registers `idra_photo` with Codex. Your other Codex settings are kept, and a backup is made if it has to edit `config.toml` itself.
- Lets Idra read photos you drag in from Downloads, Desktop, Pictures, temp, and Codex's own generated-images folder.

Idra needs Node.js 22.13 or newer. On Windows, if you do not have Node, Idra uses the Node that ships inside Codex. The launcher looks for Node every time Codex starts it, so Codex or Node updates do not break it.

Options: `install.cmd --workspace "D:\Shoots\Idra"` picks another folder. `--dry-run` only shows what would be written.

Remove it any time (your images stay):

```bash
idra-photo.cmd uninstall-codex
```

On macOS/Linux use `sh idra-photo.sh uninstall-codex`. Check that everything is ready with `idra-photo.cmd doctor`.

## Use it

Drag your photo into the Codex chat and write something like:

> Use Idra Photo. Make 20 photos in the exact same style as this image: a woman holding our vitamin C serum in a sunny garden. 4:5.

Codex creates the batch, then loops: get a job, generate the image, report it, get the next one. Images land in:

```
Idra Photo/outputs/<batch-name>/
    001-a-woman-holding-our-vitamin-c-serum.png
    002-a-woman-holding-our-vitamin-c-serum.png
    manifest.json
```

More things you can say:

| You say | What happens |
|---|---|
| "Idra status" / "how far is my batch?" | Counts and where it stopped |
| "Pause the batch" | No new images start. One already generating can still finish. |
| "Resume it" | Makes the remaining jobs available again. Codex continues. |
| "Cancel it" | Stops new work. Saved images stay. |
| "Retry the failed ones" | Re-queues failures that are safe to retry. Safety refusals are never retried or reworded. |
| "Make 10 more" | Adds jobs 21-30 with the same style, references, and rules. |
| "Make 5 different concepts: beach, café, gym, office, night" | Diversified mode: one concept per image. |
| "Use these exact prompts: ..." | Explicit mode: your prompts, unchanged. |

### Keeping things the same

Codex passes these as rules on every image. They are prompt requirements, not pixel locks. Check the results yourself.

- **Style**: match the reference's color grading, light, lens look, and mood.
- **Product**: keep the packaging, label, logo, colors, and proportions.
- **Identity**: keep a person recognizable.
- **Text**: render given words exactly.
- **Composition**: keep framing and placement.

Each can be `off`, `high`, or `strict`. A valid image file is not proof the product or face was preserved. Idra records whether a visual review was actually done.

### When something goes wrong

- **Codex closed mid-batch.** Say "resume my Idra batch". If an image was saved to its job folder but never reported, Idra adopts it and does not make it again. If Idra cannot tell whether it was made, it asks you before regenerating.
- **Usage limit or tool unavailable.** The batch pauses. Idra never guesses when limits reset and never switches providers. Resume later.
- **Codex stops after one image.** Some hosts end the turn after each image. Say "continue" to go on; Idra keeps the place.

## Privacy and limits

- Idra only reads your workspace folder and the folders listed with `--allow-import`, which by default are Downloads, Desktop, Pictures, temp, and Codex's generated-images folder. It only accepts PNG, JPEG, and WebP images from them, and copies references into the workspace.
- It never reads Codex login files and never asks for passwords, tokens, or API keys.
- No telemetry. Idra makes no network requests at runtime.
- Idra does not make image generation free or unlimited. Every image uses your Codex plan.

## For developers

```bash
npm install
```

```bash
npm test
```

`npm run bundle` rebuilds `idra-photo.mjs` from `src/`. Commit it with your change; CI fails if it is stale.

## Learn more

- [How it works](docs/architecture.md)
- [Compatibility and evidence](docs/compatibility.md)
- [Testing, including the real smoke test](docs/testing.md)
- [Measured overhead](docs/overhead.md)
- [Build status](BUILD_STATUS.md)

MIT licensed. See [LICENSE](LICENSE).

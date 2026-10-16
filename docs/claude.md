# Codex and Claude setup

Idra Photo has two parts: a **skill** that turns a short request into a useful design workflow, and a **local MCP server** that stores the brief, supplies jobs, exposes references/results for review, and enforces acceptance. An image-generation tool supplies the actual images.

## Claude Code: one project setup command

Install Node.js 22.13 or newer and clone this repository into a permanent folder with `git clone https://github.com/bbrainfuckk/idra-photo.git`. Then run from the checkout:

```text
node idra-photo.mjs install-claude --project "/absolute/path/to/your/design-folder"
```

On Windows, `idra-photo.cmd install-claude --project "C:\Designs"` also works. Add `--workspace "C:\Designs\Images"` to choose where batches are saved. No npm install is needed.

This writes a project `.mcp.json` entry and `.claude/skills/idra-photo/`, backs up changed files, and preserves other MCP servers. Open Claude Code in that project and approve the local server when Claude prompts. Restart an already-running client after installation. Then ask:

> Use Idra Photo: make 2 skincare photos.

Or attach a reference and say:

> Make 3 images in this style. Keep the product the same.

The skill handles the detailed brief. It preserves explicit user choices and asks only for essential missing inputs, such as the actual product reference when exact packaging matters. `idra_design_brief` can prepare the strict request without generating or creating a batch. `idra_inspect_image` returns authorized image pixels and their SHA-256 for review, so an extra hashing script is unnecessary.

**Claude requires a connected image-generation tool/MCP that can return a local PNG/JPEG/WebP.** Claude does not natively generate photos. If that capability is missing, the skill returns the brief and explains setup rather than inventing images. Configure the generator to save into the Idra workspace or an authorized import folder; remote URLs alone are not local artifacts. Never supply API keys in prompts.

Use `--dry-run` to preview installation. `uninstall-claude --project <folder>` removes only the Idra MCP entry; saved images and skill files remain. Remove the skill folder manually if you no longer want it.

## Claude Code plugin

The repository also bundles `.claude-plugin/plugin.json`, a marketplace manifest, the same `skills/idra-photo/`, and an inline local MCP definition. With a current Claude Code release, install it with:

```text
/plugin install idra-photo --marketplace bbrainfuckk/idra-photo
```

For a local checkout, use the project installer above, or load it with `claude --plugin-dir /absolute/path/to/idra-photo`. The plugin needs `node` on PATH. Its workspace defaults to `~/Idra Photo` unless `IDRA_WORKSPACE` is set. It explicitly enables the same standard import folders as the Codex installer: existing Downloads/Desktop/Pictures/temp and Codex generated-image folders. Use the project installer to authorize the chosen project directory too.

## Claude Desktop and claude.ai

Claude Desktop's local MCP configuration can launch the same server. Merge an entry like this into `claude_desktop_config.json`, using real absolute paths and preserving your other entries:

```json
{
  "mcpServers": {
    "idra_photo": {
      "command": "node",
      "args": ["/absolute/path/to/idra-photo/idra-photo.mjs", "serve", "--workspace", "/absolute/path/to/images"]
    }
  }
}
```

Add `--allow-import` arguments for any specific provider output/reference folders outside that workspace. Enable the portable `skills/idra-photo` folder through the custom-skill mechanism available in your Claude account/client. The MCP and image provider must also be connected; uploading a skill does not connect them.

This Desktop configuration is documented, not a completed live Desktop UI test. Local stdio MCP servers do not become remote connectors for claude.ai or Cowork. A remote server deployment is not included in this package.

## Verified compatibility

The installer is exercised with a real stdio client against the generated Claude project config. Claude Code **2.1.296** also reported `idra_photo: connected` when launched with the explicit test MCP config. Its model-backed skill test then stopped at **“Not logged in · Please run /login”**. Therefore MCP connection and skill packaging are verified; autonomous Claude skill behavior and Claude image generation have not been claimed as tested. Native image results in this repo were generated in Codex.

Official references: [Claude skills](https://code.claude.com/docs/en/skills), [Claude MCP configuration](https://code.claude.com/docs/en/mcp), [Claude image capabilities](https://support.claude.com/en/articles/9002504-can-claude-produce-images), and [local versus remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

# Consolidated design reference library

Text snapshots from all six repositories investigated for consistent designer output. Collected on **2026-10-16**. Exact Git revisions, included paths, and license labels are in [`sources.json`](sources.json). Includes 298 text files and 171 image-style JSON definitions. Images, previews, binaries, dependencies, and unrelated application code are omitted.

| Source | Included material | Application in Idra Photo |
|---|---|---|
| [interface-design](https://github.com/Dammyjay93/interface-design) | Core skill, system template, example systems | Save decisions once and reuse them |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Workflow template and design catalogs | Global rules with explicit page differences |
| [Impeccable](https://github.com/pbakaus/impeccable) | Core skill and document/audit/polish/extract references | Concrete rules and an explicit review bar |
| [AI Visual Prompt Cookbook](https://github.com/VigoZhao/AI-Visual-Prompt-Cookbook) | Every top-level style folder's `style.json` | Fixed visual systems with variable content |
| [ai_asset](https://github.com/tnbao91/ai_asset) | Studio primer, schemas, style tokens, YAML presets | Reference → guide → prompt → review → correction |
| [brand-spec](https://github.com/gramatr/brand-spec) | Brand schema and templates | Shared brand rules for visuals and images |

These files are **reference data**, not executable dependencies or automatically installed skills. They do not become Idra server policy. Runtime consistency uses Idra's own contract and acceptance gate in `src/core/consistency.ts`; see [the workflow](../docs/consistency.md). Upstream quality claims are not treated as benchmark results.

Ask Codex to browse the library with `idra_design_library`. With no arguments it lists the six sources; `source` plus `query` searches file names. Then pass `source` and an exact `file` to read a style or guide. Long files return `next_offset` for another read. This works offline from the complete clone and installed package.

## Attribution and licenses

Each source's full `LICENSE` accompanies its files under `upstream/<source>/`. Copied text is unmodified apart from Git checkout line endings. Runtime integration and examples are new Idra code; upstream packages are not imported.

- **interface-design:** Damola Akinleye, MIT.
- **UI UX Pro Max:** Next Level Builder, MIT.
- **Impeccable:** Paul Bakaus and contributors, Apache-2.0; `NOTICE.md` is retained. Platform reference files are omitted.
- **AI Visual Prompt Cookbook:** VigoZhao / [@VigoCreativeAI](https://x.com/VigoCreativeAI). Code/docs are MIT; **`style.json` prompts are [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**, as stated in the included README. Retain attribution and the license link, and identify adaptations when reusing prompts. Preview images are omitted.
- **ai_asset:** Bao Tran (tnbao91), MIT.
- **brand-spec:** grāmatr, MIT.

Snapshots retain their upstream licenses; Idra's root MIT license does not replace them. Refreshes must recheck licensing and update the pinned revision and file list in `sources.json`.

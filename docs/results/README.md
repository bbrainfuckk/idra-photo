# Real generation results

Generated and reviewed on **2026-10-16** in Codex desktop with its built-in `image_gen` tool. A manual host called the real Idra queue API, passed the returned prompts to image generation, inspected the outputs, and submitted file-bound review evidence. These are real images, not fixtures or HTML screenshots. This is a small qualitative demonstration, not a general quality benchmark or an autonomous Claude generation test.

## Product photos

Short user prompt: **“Make 2 square skincare product photos.”**

The starter brief chose a warm cream editorial treatment, matte materials, soft upper-left light, and no invented branding. The host supplied one front view and one changed-angle concept without asking the user to write a production prompt.

| First accepted image | Accepted angle correction |
|---|---|
| ![Front-on skincare product](product/1.png) | ![Skincare product with a visibly foreshortened pump](product/2.png) |

The first attempt at image two was [rejected](product/rejected-1.png): its requested three-quarter angle was barely distinguishable from the anchor. The retry visibly foreshortened the pump spout while keeping the overall palette, light, and material treatment. Two final images were accepted from three real generations. This demonstrates a coherent generic product concept; it does not prove exact real-SKU geometry.

The product test began before the explicit `brief` rule was added to starter contracts. Its overall failed review caught the missing change even though the style rules passed. That observation led to the new default content/variation check; the saved [brief](product/brief.json) preserves the actual contract used at the time.

Evidence: [manifest and accepted reviews](product/manifest.json), [actual retry prompt and observations](product/generation.json).

## Matching UI concepts

Short user prompt: **“Make a matching dashboard and settings screen, square.”**

The host selected two concepts and a shared white/charcoal/blue system, sidebar, typography hierarchy, component treatment, and density.

| Accepted dashboard | Accepted settings concept |
|---|---|
| ![Blue and white analytics dashboard](ui/1.png) | ![Matching account settings screen](ui/2.png) |

The [first dashboard](ui/rejected-1.png) was rejected for adding green percentage arrows and status marks despite the single-blue-accent rule. The correction removed that extra color. The accepted dashboard then served as the settings screen's style anchor. Two final images were accepted from three real generations. These are visual concept images with sample data, not functional screens or a pixel-perfect implementation.

Evidence: [starter brief](ui/brief.json), [manifest and accepted reviews](ui/manifest.json), [generation/rejection prompts and observations](ui/generation.json).

## What these results establish

The short prompts were expanded into explicit rules, real mismatches were rejected, corrective instructions reached new attempts, and the accepted sets retained a coherent look. All four accepted images are square, and their file hashes and review evidence are saved. The reviewing agent supplied the visual judgments; no independent designer review, objective visual score, exact-color measurement, or cross-model comparison is claimed. Rejected examples remain visible so the correction process is inspectable.

Published `1.png` and `2.png` are unchanged copies of each manifest's accepted sequence 1 and 2 files; `rejected-1.png` matches its rejected attempt's hash. Original queue filenames remain in the manifests. A separate [sanitized Claude connection record](claude-connection.json) verifies MCP/skill discovery and records the login limit on the model-backed test.

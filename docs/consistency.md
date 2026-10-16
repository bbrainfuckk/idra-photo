# Strict consistency

Decide the visual system once and reuse it across a batch. Idra v0.2 stores a named `consistency` contract, repeats it in each job, and blocks acceptance without complete, file-specific review evidence.

## For designers

Start with a short request such as **“Use Idra Photo: make 2 skincare photos”** or **“Make a matching dashboard and settings screen.”** The portable skill prepares the detailed rules with `idra_design_brief`, states its assumptions, and checks that generation is available. See [Codex/Claude setup](claude.md) and [real results](results/README.md).

For a particular brand or look, add a reference and these details when you have them:

1. What to make, who it is for, and the required aspect ratio.
2. What stays fixed: palette, medium, lighting, typography, layout, materials, branding, and exclusions that matter to the project.
3. What may change: subjects, poses, angles, props, or backgrounds.

Ask for **Idra Photo with strict consistency**. Codex converts the brief into concrete rules, generates each image, inspects it, and reports observations for every rule. Use exact user-supplied or sampled colors when those matter; guessed hex values are not measurements.

“Prompting ba ang problem, or platform?” **Parehong puwedeng dahilan.** Kapag kulang o pabago-bago ang brief, mag-iiba rin ang resulta. Kapag malinaw na ang reference at rules pero hindi pa rin nasusunod ang identity, layout, o edits, limitasyon na rin iyon ng image tool. Dito, isang visual direction ang sine-save at chine-check sa bawat image.

The [design library](../design-library/README.md) consolidates reference material from six repositories. Pick one visual direction and translate relevant guidance into a small contract; do not stack unrelated styles. The snapshots are reference data and do not install or execute upstream skills.

## Contract

Pass `consistency` to `idra_create_batch`. See complete [product-photo](../examples/consistency/product-photo.json) and [UI-concept](../examples/consistency/ui-concept.json) inputs. Rule IDs must be unique, lowercase, and stable; `constraint.*` is reserved. Each instruction must be specific and reviewable.

`allowed_changes` defaults to an empty list. Valid axes are `subject`, `pose`, `framing`, `angle`, `background`, `lighting`, `setting`, `props`, and `text`. Automatic variety uses only those axes. Host-written concepts must also respect the contract; the server cannot reliably detect natural-language contradictions. Framing/angle exceptions conflict with a composition lock, lighting exceptions with strict style, and text exceptions with strict text; these inputs are rejected.

The immutable contract hash covers the normalized contract, original constraints, and requested aspect. Creation, jobs, and status return it. Resume and `idra_extend` reuse it. Create a new batch to change direction. Existing databases migrate with `consistency_json = NULL`; legacy `style: strict` alone retains its original prompt-only behavior.

The first reviewed, accepted image becomes an additional **style** reference for later jobs, including extensions. It supplies palette, light, texture, and finish; subject/product/person/composition references remain distinct. A missing, altered, or invalid anchor pauses the batch. Restore it before resuming.

## Review protocol

Inspect the actual result against the references. `idra_inspect_image` returns authorized image pixels and their SHA-256; a local viewer plus a file hash also works. Metadata alone is not a visual review. Then submit `idra_step.completed.review`:

```json
{
  "performed": true,
  "passed": true,
  "contract_hash": "<hash from job.consistency.contract_hash>",
  "artifact_sha256": "<SHA-256 of the actual image bytes>",
  "checks": [
    {"rule_id": "palette", "passed": true, "observed": "Describe the palette actually visible in this result."}
  ]
}
```

Use exactly one check for every entry in `job.consistency.rules`, including generated `constraint.product`, `constraint.identity`, `constraint.text`, `constraint.composition`, or `constraint.style` checks. Observations must describe the inspected result. Never fabricate observations. Missing, duplicate, unknown, or empty checks are rejected; top-level `passed: true` cannot override a failed check.

- `REVIEW_REQUIRED` leaves the attempt open without consuming a retry. Inspect and submit complete evidence for the same file; do not regenerate it.
- Failed reviews and aspect mismatches beyond the existing 1% tolerance reject the file and consume the normal retry budget (default two, maximum five). The next attempt carries correction feedback and the unchanged contract. Rejected files stay in staging and never count as accepted outputs. The same rejected bytes cannot be approved later by changing the checklist. Exhausted jobs fail; further retry cycles require the user's existing retry control.
- `idra_reconcile` actions `check` and `adopt` require the same `review`. `accept_duplicate` never waives it. Missing evidence cannot silently promote a file after a crash.

Accepted reviews and rejected-attempt evidence are exported in `manifest.json`. Attempt tokens are never exported.

## What is enforced

Idra deterministically checks contract identity, review coverage, file identity, automatic variation axes, aspect, image structure, duplicate bytes, and retry limits. **Visual observations are host-supplied judgments. Idra has no vision model and cannot prove that observations are truthful.** A complete checklist is not proof of exact color, geometry, text, identity, or quality. Exact logos, typesetting, and final UI geometry may require real assets, an editor, or UI code.

Automated tests use synthetic images and explicitly synthetic observations. They prove acceptance, persistence, recovery, and retry behavior; they do not benchmark an image model. The [real product/UI demonstrations](results/README.md) record actual rejected attempts and corrections. A larger independent designer review and cross-model benchmark remain open.

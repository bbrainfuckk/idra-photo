# image-generation-example — worked template for the v1.6 image-generation layer

This template demonstrates the `image-generation/` layer added in
`brand-spec` v1.6.0. It uses a hypothetical brand, **Acme Regenerative
Media** — a fictional B2B media company serving the regenerative
agriculture sector — as the example brand. Acme is intentionally fake;
nothing here ships in any real brand repo. The agriculture framing was
chosen because it lets the template demonstrate the cross-link to a
photography-treatment file (the real-world parallel is
`lean-media-brand/design/photography-treatment.md`).

## How to use this template

1. Copy `image-generation/` into your brand repo at the brand root.
2. Replace Acme's style anchors and reference image URLs with anchors
   that match YOUR brand's visual baseline. If you have a
   `design/photography-treatment.md`, point the
   `photography_treatment_ref:` field at it.
3. Replace Acme's subject-matter themes (what to depict, what never to
   depict) with your own. The themes array is optional but useful for
   AI agents picking subjects from a controlled set.
4. Tune the `universal_negatives` array in `negative-prompts.md` to
   the failure modes your brand cares about. Universal entries
   (warped hands, extra fingers, text artifacts) apply to almost any
   brand; brand-specific entries (off-brand color treatments,
   forbidden categorical likenesses) vary.
5. Decide your people-depiction position. Acme depicts working
   farmers in environmental settings; your brand may not depict
   people at all, or may have very different conventions. Populate
   `people.md` accordingly, or omit the file if your brand does not
   generate people imagery.
6. If your brand applies logo overlays or color treatments to
   generated imagery, fill `brand-overlays.md` and reference your
   `assets/_manifest.md` and `design-tokens.md`. If not, omit the
   file.
7. Decide your provenance position. Acme requires `model`, `prompt`,
   `generation_date`, and `brand_approval_status` on every published
   image. Tune to your jurisdictional context and brand policy.
8. Delete the `status: sample` frontmatter line on each file once it
   reflects real brand decisions.

## What this template demonstrates

- **Reference, don't redeclare.** Acme's `style.md` references a
  hypothetical `design/photography-treatment.md` rather than restating
  visual direction. Acme's `brand-overlays.md` references
  `assets/_manifest.md` for clear-space and `design-tokens.md` for
  brand colors — never duplicating values.
- **Style anchors with concrete references.** Acme cites Kodachrome
  colorimetry, FSA documentary photography, and named contemporary
  agriculture photographers — not just abstract adjectives.
- **Subject-matter as canonical + negative-space.** Acme depicts
  working agriculture; Acme never depicts urban-tech-stock, generic
  network-mesh imagery, or smiling-headset stock photography.
- **Universal-negatives array.** Acme's `negative-prompts.md` declares
  the always-appended fragment list AI agents include in every
  generation request.
- **People-depiction rules.** Acme declares age range
  (`working-age adults`), diversity intent
  (`reflect-customer-base — US Midwest agriculture`), and
  forbidden-likeness categories.
- **Provenance fields populated.** Acme's `provenance.md` declares
  the required-when-published field set (model, prompt,
  generation-date, brand-approval-status) plus recommended fields
  (seed, negative-prompt) and a labeling convention.

## What this template intentionally omits

- **Per-model variants.** v1.6 is model-agnostic — no
  `image-generation/midjourney.md` or `image-generation/dalle.md`
  files. When real divergence in prompt syntax surfaces, per-model
  files MAY be added in a future patch.
- **The `assets/_manifest.md` and `design/photography-treatment.md`
  files Acme references.** Those would duplicate the empty-brand
  template; assume Acme has them populated.
- **`design-tokens.md`** — same reason; assume Acme declares the
  tokens this layer references (`--brand-primary`,
  `--brand-secondary`).

## Status

All files in this template carry `status: sample`. Validators MAY
skip strict value validation per the
`sample-status-tolerates-placeholders` rule. Real brand content MUST
NOT use `status: sample`.

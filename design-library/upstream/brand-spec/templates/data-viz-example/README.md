# data-viz-example — worked template for the v1.5 data-viz layer

This template demonstrates the `data-viz/` layer added in `brand-spec`
v1.5.0. It uses a hypothetical brand, **Acme Analytics** — a fictional
B2B analytics company — as the example brand. Acme is intentionally
fake; nothing here ships in any real brand repo.

## How to use this template

1. Copy `data-viz/` into your brand repo at the brand root.
2. Replace Acme's color-role assignments with references to YOUR
   brand's design tokens (file: `data-viz/colors.md`).
3. Replace Acme's allowed/forbidden chart-type policy with your own
   (file: `data-viz/chart-types.md`).
4. Tune number formatting to your locale and currency (file:
   `data-viz/numbers.md`).
5. Decide whether annotations carrying numeric claims must cite a
   source. Acme requires it; you may not (file:
   `data-viz/annotations.md`).
6. Delete the `status: sample` frontmatter line on each file once it
   reflects real brand decisions.

## What this template demonstrates

- **Color roles → token references.** Acme's `data-viz/colors.md`
  assigns categorical, sequential, diverging, and semantic roles to
  design-token names — never to hex literals. The hex values live in
  Acme's (hypothetical) `design-tokens.md`.
- **Per-brand chart-type policy.** Acme allows bar, line, area,
  stacked-column, scatter, and heatmap. Acme forbids pie, donut, and
  3D anything — Acme's argument is that pies obscure the comparisons
  Acme exists to clarify. Your brand may make the opposite call.
- **Number formatting precision rules.** Acme defines currency,
  percentage, and large-number scientific-notation thresholds.
- **Required-source annotations.** Acme sets
  `source_citation_required: true` and demonstrates a big-stat
  callout with the canonical qualifier-line + source format.

## What this template intentionally omits

- `data-viz/tables.md` is included to show the slot, but most brands
  fill it later than the other files. Tables are the lowest-priority
  data-viz file for most brands.
- This template carries no design-tokens.md — it would duplicate the
  empty-brand template. Assume Acme's `design-tokens.md` declares the
  tokens this layer references (`--brand-primary`,
  `--brand-secondary`, `--surface-subtle`, `--semantic-success`,
  `--semantic-error`, `--gray-60`).

## Status

All files in this template carry `status: sample`. Validators MAY
skip strict value validation per the
`sample-status-tolerates-placeholders` rule. Real brand content MUST
NOT use `status: sample`.

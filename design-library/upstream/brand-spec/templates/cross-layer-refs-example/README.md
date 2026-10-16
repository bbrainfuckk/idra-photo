# cross-layer-refs-example

Worked example for the v1.7 **cross-layer reference syntax**
convention (`conventions.cross_layer_references:` in `brand.yaml`,
closes RFC #31).

The example is contrived but realistic. A fictional
`messaging/channel-deck.md` (a deck channel guide) declares its
cross-layer references both ways:

- **Frontmatter naming convention** — `data_viz_ref:` (singular,
  one file) and `personas_refs:` (plural, two persona files).
  Low-ceremony; preferred for most refs.
- **Optional `references:` block** — used when the reference
  needs explicit `kind` (`requires` / `recommends` / `cites`),
  structured `layer-entries` sub-selection, or a free-text
  `notes` edge label that downstream reference-graph consumers
  can surface.

A sibling `data-viz/colors.md` is the resolution target for the
`data_viz_ref:` field, demonstrating that the validator's generic
resolver checks the file exists.

## Why both shapes in one file

Authors mix the two intentionally — most references want only a
target (use the naming convention), and a small minority want
edge metadata (use the `references:` block). The example
deliberately shows both side-by-side so readers see how authors
choose between them.

## What this example does NOT do

- Migrate any of the 6 existing invention sites
  (`source_authority.upstream`, `agent-context.priority_layers`,
  `voice/registers.applies_to`, journey stage refs,
  `data-viz/colors.md` token refs,
  `image-generation/style.md` and `brand-overlays.md` refs).
  Those migrations land as separate v1.7.x patches so each can
  be audited independently.
- Demonstrate inline body-reference syntax (`{{ ref:name }}`).
  Frontmatter refs only in v1.7; body-level refs are deferred
  until a real consumer surfaces the need.
- Demonstrate URI-scheme pointers (Option D from the RFC,
  `brand-spec://layer/path`). Deferred to v2.

## Files

- `messaging/channel-deck.md` — the consuming file; demonstrates
  both reference shapes.
- `data-viz/colors.md` — the resolution target for
  `data_viz_ref:`. Empty stub; the example exists to show the
  validator can resolve the path, not to demonstrate the
  data-viz layer (see `templates/data-viz-example/` for that).

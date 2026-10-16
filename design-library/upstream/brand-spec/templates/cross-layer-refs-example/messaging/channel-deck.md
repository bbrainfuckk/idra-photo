---
status: sample
brand: cross-layer-refs-example
last_updated: 2026-05-10

# (v1.7) Frontmatter naming convention — `*_ref` / `*_refs`.
# Any field whose name matches `^[a-z_]+_refs?$` is a cross-layer
# reference and gets resolved by the validator's generic resolver.

# Singular `*_ref` — one scalar value (here: a file path).
data_viz_ref: data-viz/colors.md

# Plural `*_refs` — array of values (here: layer names that
# resolve against brand.yaml's top-level `layers:` block).
priority_layers_refs:
  - identity
  - voice
  - vocabulary

# Plural `*_refs` — array of file paths.
personas_refs:
  - personas/buyer-economic.md
  - personas/buyer-technical.md

# A `path_with_fragment` reference — file portion is checked by the
# validator; the anchor is `warn`-only until the body-parse
# subsystem lands.
forbidden_chart_types_ref: data-viz/chart-types.md#forbidden

# (v1.7) Optional structured `references:` block — used when the
# reference needs richer metadata (`kind`, `entries`, `notes`).
# Most files do NOT need this; reach for it only when the extra
# fields earn their cost.
references:
  data_viz:
    type: file
    target: data-viz/colors.md
    kind: requires
    notes: |
      The deck channel inherits role-to-token color assignments
      from data-viz; deck generators MUST load this file before
      producing slides.

  primary_color:
    type: token
    target: --color-brand-primary
    kind: requires
    notes: |
      Slide title bars and headline accent fills resolve to this
      token. Validator emits `warn` (not `error`) on
      unresolvable token refs until the body-parse subsystem
      lands.

  related_journey_stages:
    type: layer-entries
    target: journey/stages/
    entries:
      - problem-recognition
      - option-evaluation
    kind: recommends
    notes: |
      Stage-aware deck variants enrich the discovery and
      evaluation moments; absent these stages the deck still
      renders, but stage-targeted CTAs degrade.

  industry_report:
    type: url
    target: https://example.com/industry-report-2026
    kind: cites
---

# Channel guide — Deck

This file is a *sample* demonstrating the v1.7 cross-layer
reference syntax convention. It carries no real channel
guidance; see `templates/empty-brand/messaging/` and the real
brand `messaging/channel-*.md` files for that.

The frontmatter above shows two co-equal mechanisms in one file:

- **Naming convention** (`data_viz_ref`, `priority_layers_refs`,
  `personas_refs`, `forbidden_chart_types_ref`) — the common
  case. Low ceremony. The validator's generic resolver checks
  every matching field.
- **Structured `references:` block** — the rich case.
  `kind: requires` declares hard dependencies; `kind: recommends`
  declares enriching ones; `kind: cites` declares informational
  attribution. Downstream reference-graph consumers (AI agents
  building a brand graph for context-windowing, validators
  emitting dependency reports) read both shapes uniformly.

## How to read this in a real brand

A brand author writing a real `messaging/channel-deck.md` would
typically use the naming convention alone for routine refs
(`data_viz_ref`, `assets_manifest_ref`) and reach for the
structured `references:` block only when an edge needs `kind`
metadata or `layer-entries` sub-selection. Using both in one
file is supported — they describe overlapping but not redundant
edges.

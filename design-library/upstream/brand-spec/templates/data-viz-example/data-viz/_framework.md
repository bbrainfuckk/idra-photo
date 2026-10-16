---
type: framework
version: "1.0"
status: sample
last_updated: 2026-05-10
confidence: high
---

# Data viz — Framework (Acme Analytics)

## What this layer covers

The `data-viz/` layer is the canonical home for every rule that
governs how Acme renders numbers and data shapes. It covers:

- **Color** — which design-token role goes to which data role.
  See `colors.md`.
- **Chart types** — what Acme uses, what Acme refuses to ship.
  See `chart-types.md`.
- **Axes and grid** — origin behavior, tick density, label
  conventions. See `axes-and-grid.md`.
- **Annotations** — big-stat callouts, inline highlights, source
  citation rules. See `annotations.md`.
- **Numbers** — currency, percentages, large numbers, precision.
  See `numbers.md`.
- **Tables** — header treatment, alignment, empty-cell convention.
  See `tables.md`.

## When to use this layer vs design-tokens

`design-tokens.md` is the source of truth for VALUES (hex, font
family, sizing scale). `data-viz/` is the source of truth for ROLE
ASSIGNMENT — which token plays which role in a chart. The same hex
that is `--brand-primary` in design-tokens becomes `categorical-1`
in data-viz.

If you find yourself writing a hex value in any `data-viz/` file,
stop — that value belongs in `design-tokens.md`. The data-viz file
should reference the token name.

## Relationship to channel guides

Before v1.5, Acme's chart guidance was duplicated across
`messaging/channel-deck.md`, `messaging/channel-social.md`, and
`messaging/channel-landing-page.md` — three near-identical sections,
already drifting. With this layer in place:

- `data-viz/` is the single source for chart conventions.
- Channel guides reference `data-viz/` rather than restate it.
- Channel guides retain channel-specific deviations (e.g., social
  posts have a single chart per image, decks may have 1-2 per slide)
  — but the underlying chart rules are not duplicated.

## How downstream tools consume this layer

AI agents and chart generators that produce Acme artifacts MUST:

1. Load `data-viz/colors.md` and resolve every role reference to a
   design-token value before rendering.
2. Validate the requested chart type against
   `data-viz/chart-types.md`'s `allowed:` and `forbidden:` arrays.
3. Apply `data-viz/numbers.md` formatting rules to every numeric
   value rendered in axes, labels, or annotations.
4. When an annotation carries a numeric claim, attach a source
   citation per `data-viz/annotations.md`'s
   `source_citation_required: true` rule.

Tools that cannot honor a rule SHOULD emit a warning rather than
silently substituting.

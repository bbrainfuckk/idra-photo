---
type: iconography
status: open
version: "0.1"
last_updated: "2026-05-10"
confidence: medium

# REQUIRED: which icon set the brand uses, and (when versioned) the version.
# `name` is the only required sub-field. Common values: lucide,
# material-symbols, heroicons, phosphor, tabler, feather, custom.
icon_set:
  name: lucide
  version: "0.300.0"
  # OPTIONAL: variant indicator for sets with multiple stylistic variants
  # (e.g., material-symbols `outlined` / `rounded` / `sharp`).
  # variant: outlined

# OPTIONAL: URL to the canonical source for the icon set.
set_authority: "https://lucide.dev"

# REQUIRED: how the brand colors icons.
#   monochrome       — always one color (typically a neutral)
#   brand-color      — always a brand primary or accent
#   functional       — semantic colors per role (success / warning / etc.)
#   mixed-with-rules — brand uses several treatments; body documents which
color_treatment: monochrome

# OPTIONAL: stroke (line) vs fill (solid) preference.
#   stroke | fill | mixed
stroke_vs_fill: stroke

# OPTIONAL: named icon sizes mapped to design-token names.
# The tokens themselves MUST be declared in design-tokens.md (or ui-tokens/);
# this block REFERENCES them by name. Never redeclare px or rem values here.
sizing:
  xs: "--icon-size-xs"
  sm: "--icon-size-sm"
  md: "--icon-size-md"
  lg: "--icon-size-lg"
  xl: "--icon-size-xl"

# OPTIONAL: clear-space rules around icons. Reference design-tokens by name
# when possible; numeric pixel values are acceptable when no token applies.
spacing:
  clear_space: "--space-2"
  inline_gap:  "--space-1"

# OPTIONAL: declared exceptions to the one-set rule. Most brands SHOULD use
# one set for consistency; declare exceptions here with a stated reason.
# Omit this block if the brand mandates one set with no exceptions.
# exceptions:
#   - set: material-symbols
#     use_case: "in-product app chrome only"
#     reason: "Material set ships richer icons for product-specific actions; marketing surfaces remain on the primary set."
---

# Iconography (SAMPLE)

> **This is a sample file.** Replace with your brand's real iconography
> conventions, or delete the file if your brand does not have a UI surface
> requiring iconography. The file is **recommended-not-required** —
> brands without icon discipline can omit it cleanly. Delete this callout
> when you replace the content.

## Icon set choice and rationale

The brand standardizes on **Lucide** (v0.300.0) as the single icon set
across all surfaces. Lucide was chosen for its open license (ISC), broad
coverage of common UI metaphors, and consistent stroke-based visual
language.

When an icon is needed that Lucide does not provide, the team
commissions a custom icon designed in the same stroke style and adds it
to `design/icons/` (see "Custom icons" below). The brand does NOT mix in
icons from other libraries except where declared in
`exceptions:` frontmatter.

## Sizing scale

Icon sizes follow the `--icon-size-*` token scale declared in
`design-tokens.md`. Reference tokens by name in component code; never
hard-code px values.

| Size | Token              | Typical use                            |
|------|--------------------|----------------------------------------|
| xs   | `--icon-size-xs`   | inline with body text                  |
| sm   | `--icon-size-sm`   | dense table rows, secondary actions    |
| md   | `--icon-size-md`   | primary buttons, navigation            |
| lg   | `--icon-size-lg`   | empty-state illustrations, headers     |
| xl   | `--icon-size-xl`   | feature cards, marketing surfaces      |

## Color treatment

`monochrome` — icons take their color from the surrounding text color
(`currentColor` in CSS). This keeps the icon system neutral and lets
context drive emphasis. Brand-color or functional treatment is reserved
for explicit semantic states (errors, warnings, success), which are
governed by the design-tokens semantic palette, not by per-icon color.

## Stroke vs fill

Lucide is a stroke-based set; the brand inherits that. Filled variants
are NOT used. When emphasis is needed, scale the icon up
(`--icon-size-lg`) rather than switching to a filled rendering.

## Spacing and clear-space

Icons paired with text receive `--space-1` of inline spacing on the
appropriate side. Standalone icons in buttons or chrome receive
`--space-2` of clear space on all sides to maintain target hit area.

## Exceptions (when a second set is allowed)

The brand mandates one set. Declare any exceptions in the `exceptions:`
frontmatter array with a stated reason; document the rationale here.

(Sample is currently exception-free; remove this section heading or
document any declared exceptions when populating.)

## Decorative vs functional (distinction with assets/_manifest.md)

This file governs **functional UI iconography** — navigation, actions,
status indicators, in-product chrome, marketing-page utility icons. The
icon system is consistent, monochromatic, and inherits color from
context.

**Decorative or gradient icons** that read as brand imagery (section
illustrations, gradient SVGs that double as feature graphics, hero-area
decoration) are NOT part of the icon system. They live in
`assets/_manifest.md` and are governed by the assets layer. Do not mix
the two: a gradient SVG used as section decoration is brand imagery,
not iconography, even if it happens to be SVG-shaped and small.

When in doubt: ask whether the asset participates in the icon
system's sizing, spacing, and color rules. If yes, it is iconography
(this file). If it carries brand colors as part of its own visual
identity, it is imagery (`assets/_manifest.md`).

## Custom icons

When the brand ships custom icons, they live under `design/icons/`
alongside this file (NOT in `assets/icons/`). The directory carries a
`_manifest.md` listing each custom icon with its category, intended
use, and default alt text for accessibility. See the empty-brand
template's `design/icons/` example.

(Delete this section when the brand uses only public-library icons.)

## How AI agents and downstream tools consume this layer

- **Icon-set name and version** drive runtime imports and CDN paths.
  A code generator emitting React or Vue components reads
  `icon_set.name` and `icon_set.version` to pick the correct package.
- **Sizing tokens** are read by component generators and by AI agents
  producing slide and one-pager templates. Tokens resolve through
  `design-tokens.md`.
- **Color treatment** drives default props on icon components (e.g.,
  `color="currentColor"` for monochrome).
- **Decorative-vs-functional distinction** keeps AI agents from
  pulling decorative gradient SVGs out of `assets/_manifest.md` when
  asked for an "icon" — those are brand imagery, not icons, and the
  agent should ask before substituting.

## Status

`open` — iterate as the icon system stabilizes. Flip status to
`canonical` once the set choice, sizing scale, and treatment rules
have shipped through at least one surface release.

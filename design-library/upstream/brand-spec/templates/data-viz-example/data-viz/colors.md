---
type: data-viz-colors
version: "1.0"
status: sample
last_updated: 2026-05-10
role_taxonomy: mixed
---

# Data viz — Colors (Acme Analytics)

This file assigns DATA ROLES to the design tokens declared in Acme's
`design-tokens.md`. It does NOT redeclare hex values. When a token's
hex changes in `design-tokens.md`, the role automatically picks up
the new value.

## Color roles

The role naming follows the four canonical families used across the
information-design field (Tableau, IBM Carbon Charts, Material Data
Viz, Observable Plot all use the same shape):

- **Categorical** — distinct unordered series (e.g., product lines).
- **Sequential** — ordered single-hue ramps (e.g., heatmap intensity).
- **Diverging** — two-direction ramps around a midpoint (e.g.,
  variance from baseline).
- **Semantic** — meaning-bearing (positive / negative / neutral).

## Categorical palette

For comparing distinct unordered series — typically 2 to 6 series.

| Role             | Token reference          | Notes                                       |
|------------------|--------------------------|---------------------------------------------|
| categorical-1    | `--brand-primary`        | Acme's signature blue. The "hero" series.   |
| categorical-2    | `--brand-secondary`      | Comparison series — what Acme contrasts to. |
| categorical-3    | `--gray-60`              | Tertiary / "rest of field" series.          |
| categorical-4    | `--semantic-warning`     | Use sparingly — pulls eye.                  |
| categorical-5    | `--brand-primary-soft`   | Faded brand for low-emphasis series.        |
| categorical-6    | `--gray-40`              | Background-of-field, lowest emphasis.       |

If a chart needs more than 6 categorical series, the chart is
probably wrong — collapse, group, or split.

## Sequential palette

For ordered intensity (heatmaps, choropleths, single-variable ramps).

| Role             | Token reference          |
|------------------|--------------------------|
| sequential-low   | `--surface-subtle`       |
| sequential-mid   | `--brand-primary-soft`   |
| sequential-high  | `--brand-primary`        |

## Diverging palette

For variance around a meaningful midpoint (above/below baseline,
above/below target).

| Role               | Token reference        |
|--------------------|------------------------|
| diverging-positive | `--semantic-success`   |
| diverging-midpoint | `--gray-40`            |
| diverging-negative | `--semantic-error`     |

## Semantic palette

For meaning-bearing single values (a positive delta, an error state,
a neutral fact).

| Role             | Token reference        |
|------------------|------------------------|
| semantic-positive| `--semantic-success`   |
| semantic-negative| `--semantic-error`     |
| semantic-neutral | `--gray-60`            |

## Accessibility

- All categorical pairs MUST pass WCAG AA contrast against Acme's
  default chart background (`--surface-default`).
- Sequential and diverging ramps SHOULD be tested against the three
  most common color-vision-deficiency simulations (deuteranopia,
  protanopia, tritanopia) before shipping.
- When a chart is the sole bearer of meaning (no axis labels, no
  legend), color is insufficient — add labels, patterns, or shape
  encoding.

## What never appears in a chart

- Hex literals in this file. The token reference is the source of
  truth.
- Logo gradients as data series colors. Gradients are decorative;
  data needs solid fill for accurate value comparison.
- Off-brand colors borrowed from other brands' palettes — even when
  the chart is comparing Acme to those brands.

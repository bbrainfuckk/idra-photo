---
type: data-viz-chart-types
version: "1.0"
status: sample
last_updated: 2026-05-10
allowed:
  - bar
  - column
  - line
  - area
  - stacked-column
  - scatter
  - heatmap
forbidden:
  - pie
  - donut
  - 3d-bar
  - 3d-column
  - 3d-pie
  - radar
---

# Data viz — Chart types (Acme Analytics)

Acme's chart-type policy is opinionated. The `allowed:` and
`forbidden:` arrays in frontmatter are the canonical machine-readable
form; this body documents the reasoning.

## Allowed chart types and when to use each

| Chart           | Use when                                                               |
|-----------------|------------------------------------------------------------------------|
| bar             | Comparing categories on a single measure; categories are nominal.      |
| column          | Same as bar but time on the x-axis (monthly, quarterly, annual).       |
| line            | Continuous time-series with 2+ comparable data points per series.      |
| area            | Composition over time when totals matter as much as composition.       |
| stacked-column  | Composition by category over time; up to 4 stack components.           |
| scatter         | Two-variable relationship; correlation or distribution shape.          |
| heatmap         | Two-dimensional intensity (often: cohort × time).                      |

## Forbidden chart types and why

| Chart        | Why forbidden                                                                   |
|--------------|---------------------------------------------------------------------------------|
| pie          | Humans cannot accurately compare angles. Bar chart is always clearer.           |
| donut        | Pie's worse twin — adds a hole that wastes pixels carrying no information.      |
| 3d-anything  | Perspective distortion makes accurate value reading impossible. No exceptions.  |
| radar        | Encodes nothing reliably; reads as decorative shape, not data.                  |

If a stakeholder requests a forbidden chart, the response is to ship
the equivalent allowed form (bar instead of pie) with a one-line
explanation.

## Chart-type selection by data shape

- **One number, one context** → big-stat callout, not a chart. See
  `annotations.md`.
- **One series, time** → line (continuous) or column (discrete).
- **Two series, comparison** → grouped bar or two-line chart.
- **Composition of a whole** → stacked-column over time, or bar of
  parts. NEVER pie.
- **Distribution shape** → scatter or histogram.
- **Two-dimensional intensity** → heatmap.

## One chart per surface

A slide carries one chart. A social post carries one chart. A
landing-page section carries one chart.

If the argument requires two charts, it requires two surfaces. Side-
by-side small multiples are one chart (a single comparison expressed
in n panels), not two.

Exception: dashboard contexts (analytics screens, executive reports)
are explicitly multi-chart by design and follow their own composition
rules.

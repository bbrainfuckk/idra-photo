---
type: data-viz-axes
version: "1.0"
status: sample
last_updated: 2026-05-10
origin_policy: contextual
---

# Data viz — Axes and grid (Acme Analytics)

## Y-axis origin policy (zero vs free)

Acme uses both, deliberately. The rule:

- **Bar and column charts MUST start at zero.** Length encodes
  value; truncating the axis makes small differences look large and
  is the single most common chart deception. No exceptions.
- **Line charts MAY start at the data minimum.** Position encodes
  trend, not magnitude. Truncating to show variation is acceptable
  when the data range is narrow relative to its mean — but always
  label the axis range explicitly so the reader is not surprised.
- **Diverging charts MUST be symmetric around the meaningful
  midpoint** (typically zero for variance, or the target for
  performance-vs-target).

When in doubt, start at zero.

## Gridline conventions

- Horizontal gridlines on bar/column/line charts: subtle —
  `--gray-30` or lighter — and only at major tick values.
- No vertical gridlines on time-series. Time is continuous; vertical
  rules suggest discrete buckets that are not there.
- Gridlines NEVER bolder than data series. If gridlines compete
  visually with the data, lighten them or remove them.

## Tick density and label rotation

- Aim for 4–7 ticks on a y-axis. 10+ is noise; 2 is under-labeled.
- X-axis labels: horizontal whenever they fit. Rotate to 45° only
  when horizontal labels would overlap. Never rotate to 90° on
  display surfaces (slides, web) — it is hostile to readers.
- For time-series longer than 12 periods, label every 2nd or 3rd
  tick rather than every tick.

## Axis label typography

Axis labels follow `design-tokens.md` typography conventions:

- Use the body font family.
- Minimum size: 10pt on print/slide surfaces; 12px on web.
- Color: `--text-secondary` (axis labels are secondary to the data
  itself).

The chart NEVER carries its own title. The headline of the
surrounding surface (slide, section) is the title; restating it
inside the chart is duplication. This matches Acme's broader
no-redundant-titling principle.

## When to suppress an axis

- Suppress the y-axis entirely when each bar/column is directly
  labeled with its value. Two label sources for the same number is
  one too many.
- Suppress gridlines when bars are direct-labeled.
- Never suppress the x-axis when the categorical labels are the
  only way to know what is being compared.

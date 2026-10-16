---
type: data-viz-tables
version: "1.0"
status: sample
last_updated: 2026-05-10
---

# Data viz — Tables (Acme Analytics)

Tables sit between data-viz and prose layout. This file covers
tables AS data-viz artifacts — analytics tables, comparison tables,
results tables. General prose tables follow the typography rules in
`design-tokens.md`.

## Header treatment

- Header row: bold weight, `--text-primary` color, slightly larger
  than body rows (typically the next step up the type scale).
- Bottom border on the header row only — `--gray-40`, 1px. No box
  around the table; no gridlines between body rows.
- When header text wraps, break at logical word boundaries; do NOT
  rotate header text vertically.

## Row striping (or no striping)

Acme defaults to **no striping**. Whitespace and consistent row
height carry the structure. Striping (alternating row backgrounds)
adds visual noise and is reserved for tables with 12+ rows where
the eye genuinely needs help tracking across.

When striping is used: `--surface-subtle` for the alternating row;
header row remains the default surface.

## Column alignment by data type

| Data type       | Alignment    |
|-----------------|--------------|
| Text            | Left         |
| Categorical     | Left         |
| Numeric         | Right        |
| Currency        | Right        |
| Percentage      | Right        |
| Date            | Left         |
| Boolean / icon  | Center       |

Numeric columns always right-align. Period. This is the single
strongest convention in tabular data; violating it makes columns
unreadable for comparison.

## Numeric column conventions

- Right-align.
- Use a tabular-figures font feature when the body font supports it
  (most do — `font-feature-settings: "tnum"` in CSS). This makes
  digits monospaced so columns line up cleanly even in proportional
  fonts.
- Apply `data-viz/numbers.md` formatting rules — currency, percent,
  precision — consistently within a column.

## Empty-cell convention

Acme uses an em-dash (`—`) for cells that have no value. Never:

- Leave the cell visually blank — the reader cannot tell missing-data
  from zero.
- Use `0` for missing data — zero is a value, not an absence.
- Use `N/A` — abbreviations that look like data.

When the absence is meaningful (e.g., a feature deliberately not
offered in a comparison row), use the em-dash AND a footnote.

## Sort indicators

When the table is interactive (web), the active sort column carries
a small arrow indicator next to the header label. Inactive
sortable columns carry a dimmed arrow placeholder so the reader
knows interaction is available. Static tables (print, slides) do
not carry sort indicators — the sort order is implicit in row
order.

## Table caption and source

Every analytical table SHOULD carry:

- A caption above the table — one declarative sentence describing
  what the table shows. This is the table's "headline."
- A source citation below the table — same convention as
  `data-viz/annotations.md` (brand-internal: `Acme Analytics IDE,
  [Period]`; third-party: `[Source], [Year]`).

Captions follow body copy typography. Sources use the smaller
caption-source size from `design-tokens.md`.

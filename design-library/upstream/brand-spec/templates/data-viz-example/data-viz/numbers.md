---
type: data-viz-numbers
version: "1.0"
status: sample
last_updated: 2026-05-10
locale: en-US
currency_default: USD
---

# Data viz — Numbers (Acme Analytics)

Number formatting in data viz is stricter than in body copy. A chart
axis that mixes `1,000`, `1K`, and `1.0e3` looks broken in a way
prose does not. This file is the canonical home for those rules in
Acme artifacts.

## Currency formatting

| Magnitude              | Format             | Example          |
|------------------------|--------------------|------------------|
| Under $1,000           | `$1,234`           | `$847`           |
| $1,000 – $999,999      | `$1.2K` (1 dp)     | `$84.7K`         |
| $1M – $999M            | `$1.2M` (1 dp)     | `$84.7M`         |
| $1B+                   | `$1.2B` (1 dp)     | `$2.4B`          |

Currency symbol always precedes the number. Negative values use a
minus sign (`-$1.2M`), never accounting parens — parens read as
footnote markers in chart contexts.

## Percentage formatting

| Magnitude    | Decimal places   | Example   |
|--------------|------------------|-----------|
| < 1%         | 2 dp             | `0.42%`   |
| 1% – 10%     | 1 dp             | `4.2%`    |
| 10% – 100%   | 0 dp             | `42%`     |
| > 100%       | 0 dp             | `247%`    |

Percentages NEVER carry a leading `+` sign by default. Add `+` only
when the value is a delta and the sign carries meaning (e.g.,
`+31%` in a year-over-year comparison).

## Large-number abbreviation (K / M / B vs scientific)

Acme uses K / M / B notation in chart axes and annotations.
Scientific notation (`1.2e6`) appears only in:

- Engineering or technical artifacts where K/M/B would obscure
  precision.
- Data-table cells when the magnitude exceeds one trillion (1T+) —
  K/M/B notation breaks down past trillions.

The threshold for switching to scientific notation is `1e12`
(one trillion). Below that, use K/M/B.

## Precision rules (decimal places by magnitude)

- Default: one decimal place when abbreviating with K/M/B.
- Whole-number context (counts, headcount, votes): zero decimal
  places, always.
- Scientific or engineering context: minimum two significant figures.

Never display more precision than the underlying measurement
supports. A survey of 200 people cannot meaningfully report `42.7%`
— round to `43%`.

## Thousands separator and decimal marker

Acme defaults to `en-US`:

- Thousands separator: comma (`1,234,567`).
- Decimal marker: period (`1,234.56`).

For non-US locale variants of Acme content (e.g., `en-GB`, `de-DE`),
override in the locale-specific brand variant or in the chart
generator's locale config; this file documents the default.

## Negative-number convention

Use a minus sign (`-1,234` or `-$1.2M`). Do NOT use accounting parens
in data-viz contexts — parens read as footnote references in charts
and annotations.

## Date and time formatting in chart axes

| Granularity   | Format                     | Example         |
|---------------|----------------------------|-----------------|
| Year          | `YYYY`                     | `2026`          |
| Quarter       | `Q# YYYY` or `YYYY-Q#`     | `Q3 2026`       |
| Month         | `MMM YYYY` or `MMM`        | `May 2026`      |
| Day           | `MMM D` or `M/D`           | `May 10`        |
| Hour          | `H:MM` (24h on technical)  | `14:30`         |

Pick one format per axis; do not mix `Q3 2024`, `Q4 24`, `2025-Q1`
within a single chart.

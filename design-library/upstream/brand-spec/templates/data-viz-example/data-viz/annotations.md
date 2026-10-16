---
type: data-viz-annotations
version: "1.0"
status: sample
last_updated: 2026-05-10
source_citation_required: true
---

# Data viz — Annotations (Acme Analytics)

Acme requires every annotation that contains a numeric claim to cite
a source. This is the rule downstream chart and slide generators
MUST honor: `source_citation_required: true`.

## Big-stat (callout number) format

A big-stat is a large number with a qualifier line and a source.
This is Acme's primary annotation pattern — used on landing-page
hero sections, proof slides, and stat-driven social posts.

Canonical format:

| Element       | Treatment                                                                   |
|---------------|-----------------------------------------------------------------------------|
| Number        | 64pt+ on slides, 48px+ on web; `--font-display`; `--brand-primary` color.   |
| Qualifier     | 18-22pt; `--font-body`; `--text-secondary`; directly below the number.      |
| Source        | 8-10pt; bottom-right corner; no box, no background.                         |

The qualifier line MUST answer **what was measured / where / when**.
Without those three anchors, the number means nothing to a reader
who was not in the room when it was collected.

### Example (canonical)

```
     +31%
  incremental reach traced to radio
  vs. display-only baseline — Chicago DMA, Q3 2024, 90-day flight
                                  Acme Analytics IDE, Q3 2024
```

### Example (insufficient — DO NOT SHIP)

```
     +31%
  incremental reach
                                  Q3 2024
```

That version is a number and a date. It proves nothing because there
is no baseline, no market, and no description of what was being
measured.

## Inline annotations (highlighting a value)

When highlighting a specific data point inside a chart:

- Use `--semantic-positive` or `--semantic-negative` only when the
  highlight carries directional meaning (a win, a problem). Use
  `--brand-primary` for neutral emphasis.
- Annotation arrow weight: 1px. Annotation text: 10-12pt.
- Place annotation text outside the plot area when possible. Inside
  the plot area only when there is unambiguous open space.

## Source citation conventions

Every numeric annotation MUST cite a source. Accepted formats:

- **Brand-internal data** — `Acme Analytics IDE, [Period]`.
- **Third-party studies** — `[Source name], [Year]` (e.g.,
  `Forrester, 2026`).
- **Brand data registry** — `data/<topic>.yaml#<key>` (used in
  internal artifacts where the data file is the canonical record).

URL citations are forbidden on display surfaces (slides, social
images) — they are unreadable at presentation distance and pollute
the layout. URLs MAY appear on web pages and in document footnotes.

## Qualifier line conventions

Qualifier lines follow this template wherever practical:

> [what was measured] [vs. baseline if any] — [where], [when], [scope]

Order is intentional: subject first, comparison second, anchors
last. The reader sees the meaning before the methodology.

## Annotation typography and hierarchy

- Numbers always larger than qualifiers.
- Qualifiers always larger than sources.
- Within a single chart, all annotations use the same type scale —
  inconsistent annotation sizes suggest some values matter more than
  others when they do not.

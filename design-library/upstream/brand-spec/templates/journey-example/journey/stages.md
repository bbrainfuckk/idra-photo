---
type: stage-overview
version: "1.0"
status: sample
methodology_provenance:
  name: "CognitiveJourney"
  short_name: cognitive-journey
  originator: "Brian Handrigan"
  developed_at: "grāmatr (digital marketing agency)"
  developed_year: 2005
  refined_through: "20 years of agency, adtech, and AI work"
  continuity_note: |
    CognitiveJourney is the structured artifact that operationalizes the
    customer side of KYKC. Co-equal with KYKC itself; attributed
    distinctly so that future contributors can extend either the
    discipline or the artifact independently.
  references: []
  notes: |
    The 5-stage canonical default below is the shape that has held up
    across 20 years of B2B and B2C client work. Brands MAY extend or
    customize; the canonical slugs exist so downstream tools recognize
    stages without an alias map.
stages:
  - slug: problem-recognition
    label: "Problem recognition"
    order: 0
  - slug: information-seeking
    label: "Information seeking"
    order: 1
  - slug: option-evaluation
    label: "Option evaluation"
    order: 2
  - slug: decision-validation
    label: "Decision validation"
    order: 3
  - slug: post-decision
    label: "Post-decision"
    order: 4
---

# Journey — Stages

The 5 canonical KYKC stages, in order. Per-stage detail (mental
vocabulary, verbatim questions, triggers, hurdles, content goal) lives
in the per-stage files under `journey/stages/`.

| Order | Slug                  | Label                | Detail file                                |
|------:|-----------------------|----------------------|---------------------------------------------|
| 0     | `problem-recognition` | Problem recognition  | [`stages/problem-recognition.md`](./stages/problem-recognition.md) |
| 1     | `information-seeking` | Information seeking  | _not yet authored_                          |
| 2     | `option-evaluation`   | Option evaluation    | [`stages/option-evaluation.md`](./stages/option-evaluation.md)     |
| 3     | `decision-validation` | Decision validation  | _not yet authored_                          |
| 4     | `post-decision`       | Post-decision        | [`stages/post-decision.md`](./stages/post-decision.md)             |

## Notes for this brand (Acme HR — sample)

Acme HR adopts the canonical 5 stages as-is. Two of the five
(`information-seeking`, `decision-validation`) do not yet have per-stage
detail files because the underlying prospect-interview corpus is thin
for those stages — Acme has strong evidence for problem recognition,
option evaluation, and post-decision (where existing customers gave
extensive interviews), and lighter coverage in the middle stages. This
is fine: the `journey-stages-monotonic-order` rule applies to the
`stages:` frontmatter array above, not to the per-stage file count.
Per-stage files will be added as interview evidence accumulates.

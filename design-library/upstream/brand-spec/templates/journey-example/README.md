# journey-example

A worked example of the **journey/** layer (brand-spec v1.4+).

This template uses a hypothetical B2B SaaS brand — **Acme HR** — selling a
people-analytics product to mid-market HR leaders. It shows:

- A complete `journey/_framework.md` with two `methodology_provenance:`
  blocks (one for the discipline, one for the artifact), demonstrating
  the co-equal attribution pattern.
- A complete `journey/stages.md` with the canonical 5 KYKC stages
  declared in frontmatter.
- Three example per-stage detail files (`problem-recognition`,
  `option-evaluation`, `post-decision`) showing the full per-stage
  frontmatter shape. Two stages (`information-seeking`,
  `decision-validation`) are intentionally omitted from the per-stage
  file set to demonstrate that per-stage detail files are recommended,
  not required — `stages.md` carries the slug/label/order for all five.

## How to use this template

1. Copy `templates/journey-example/journey/` into your brand repo as
   `journey/`.
2. Replace the Acme HR mental_vocabulary, questions_asked, triggers,
   and hurdles with content drawn from real prospect interviews — do
   NOT invent these from your own marketing instincts. The whole point
   of this layer is the prospect's actual cognition, not yours.
3. Decide whether the canonical 5 stages fit your brand. If they do,
   keep the slugs as-is so downstream tools (FAQ-schema generators,
   future stage-aware messaging variants) recognize them without an
   alias map. If they don't, rename, reorder, or add stages — the
   `journey-canonical-stage-warn` validator rule is informational, not
   blocking.
4. Update or remove the `methodology_provenance:` blocks. If you are
   adopting KYKC + CognitiveJourney as the methodology your brand
   operationalizes, the existing attribution to Brian Handrigan / the
   grāmatr digital marketing agency is correct and should be preserved
   — the open-source attribution exists so any brand can credibly
   adopt the methodology with proper credit. If your brand uses a
   different methodology, replace the blocks with your own.

## What is intentionally NOT in this template

- **Journey-stage messaging variants** (e.g.,
  `messaging/for-mid-market-at-problem-recognition.md`) ship in a
  later phase. The brand-spec validation rule
  `journey-stage-slug-resolves` is `warn` in v1.4 because the
  cross-layer reference syntax has not been finalized.
- **KYKC compliance gates** (the 4 booleans Studio's MessageBrief
  uses today: `authenticClaims`, `questionsBeforeKeywords`,
  `capabilityNeedAlignment`, `cognitiveAuthority`) are deferred to a
  later phase. They will likely live in `prompts/` or a new
  `compliance/` layer, not in `journey/`.
- **`evidence_required[]`** and **`transition_signals_to_next[]`**
  fields from the original schema sketch are intentionally not in the
  v1.4 stage frontmatter. They were judged speculative until a real
  brand surfaces the need; `triggers` and `hurdles` cover most of
  what those fields would have captured.

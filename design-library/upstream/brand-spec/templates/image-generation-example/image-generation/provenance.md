---
type: image-generation-provenance
version: "1.0"
status: sample
last_updated: 2026-05-10
required_when_published:
  - model
  - prompt
  - generation_date
  - brand_approval_status
recommended_when_published:
  - seed
  - negative_prompt
  - generator_account
  - post_processing_notes
labeling_convention: caption-suffix
---

# Image generation — Provenance (Acme Regenerative Media)

## What we capture for every AI-generated image

For every AI-generated image — whether it ships to a user-facing
surface or stays in an internal artifact — Acme captures:

- **`model`** — the generator and version (e.g.,
  `midjourney-v6`, `imagen-3`, `flux-1.1-pro`).
- **`prompt`** — the full text prompt submitted, verbatim. When
  prompts contain proprietary brand instructions Acme prefers not
  to log in plain text, `prompt_hash` (SHA-256 of the prompt) is
  acceptable in lieu of the verbatim prompt for internal-only
  artifacts; user-facing artifacts MUST capture the verbatim
  prompt.
- **`generation_date`** — ISO-8601 date the image was generated.
- **`brand_approval_status`** — one of `pending`, `approved`,
  `rejected`, `approved-internal-only`. Default for new images is
  `pending`. Images SHIPPED to user-facing surfaces MUST be
  `approved`.
- **`seed`** (recommended) — generator seed for reproducibility.
  Strongly recommended for images that may need re-generation in
  consistent style.
- **`negative_prompt`** (recommended) — the negative-prompt text
  submitted (typically the universal_negatives array plus any
  contextual additions).
- **`generator_account`** (recommended) — the Acme account or API
  key that issued the request, for audit.
- **`post_processing_notes`** (recommended) — any retouching,
  cropping, color correction, or compositing applied after
  generation.

These fields live in the asset DAM (or generation-pipeline
metadata) — this file declares WHAT Acme captures, not WHERE.

## What we require before publishing

The `required_when_published` frontmatter array names the fields
that MUST be populated and non-empty before any AI-generated image
ships to a user-facing surface. Currently:

- `model`, `prompt` (or `prompt_hash` for internal use only),
  `generation_date`, `brand_approval_status: approved`.

The asset pipeline rejects publish requests for images missing any
required field. (See validation rule
`image-gen-provenance-required-when-published` — informational at
the brand-spec level; enforcement is the consumer pipeline's
responsibility.)

## User-facing labeling convention

`labeling_convention: caption-suffix`. When a generated image ships
to a user-facing surface, Acme appends a caption suffix disclosing
the AI-generated nature. Canonical formats:

- **Newsletter section divider:** caption ends with
  `(AI-generated illustration; see acme.example/ai-policy)`.
- **Social card:** alt-text begins with
  `AI-generated illustration:` followed by descriptive alt text.
- **Concept illustration in editorial:** caption includes
  `Illustration generated with [model] for editorial purposes.`

Acme does not use a visual badge or watermark on the image itself
(see `brand-overlays.md`). Disclosure is editorial, not visual.

## Approval workflow

1. Generator output is recorded in the asset DAM with
   `brand_approval_status: pending`.
2. Editorial review (one designated reviewer per surface category)
   inspects the image against `style.md`, `subject-matter.md`, and
   `people.md`.
3. Reviewer sets status to `approved`, `rejected`, or
   `approved-internal-only`. Approval comments are captured in the
   DAM.
4. Publishing pipelines accept only `approved` status for
   user-facing surfaces; `approved-internal-only` is acceptable
   for internal decks and working documents.

## Retention and audit conventions

- Generation records (the metadata fields above) are retained for
  the lifetime of the image's use plus 7 years.
- When an image is removed from public surfaces, the generation
  record is retained — Acme keeps an audit trail of every
  AI-generated image that ever published, including the prompt
  that produced it.

## Jurisdictional considerations

Acme operates in US jurisdictions with no current AI-disclosure
mandate; the caption-suffix labeling is editorial choice, not
regulatory compliance. When AI-generated imagery is published to
surfaces governed by a jurisdiction with disclosure requirements
(EU AI Act surfaces, certain US state-level requirements
emerging), the labeling convention SHOULD be revisited and the
asset pipeline updated. This file is the canonical home for that
revision.

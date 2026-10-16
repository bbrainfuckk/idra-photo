---
type: framework
version: "1.0"
status: sample
last_updated: 2026-05-10
confidence: high
---

# Image generation — Framework (Acme Regenerative Media)

## What this layer covers

The `image-generation/` layer is the canonical home for every rule
that governs how Acme produces imagery via AI generators
(Midjourney, DALL-E, Imagen, Flux, and successors). It covers:

- **Style** — visual goal, anchors, composition defaults,
  aspect-ratio defaults per channel. See `style.md`.
- **Subject matter** — what Acme depicts, what Acme never depicts.
  See `subject-matter.md`.
- **Negative prompts** — universal fragments appended to every
  generation, plus brand-specific exclusions. See
  `negative-prompts.md`.
- **People depiction** — when Acme generates people, how, and the
  forbidden likenesses. See `people.md`.
- **Brand overlays** — logo placement, watermarks, color overlays,
  attribution. References `assets/_manifest.md` and
  `design-tokens.md`. See `brand-overlays.md`.
- **Provenance** — what Acme captures for every generated image,
  what Acme requires before publishing, user-facing labeling. See
  `provenance.md`.

## When to use this layer vs commission a human shoot

Acme commissions human photography for:

- Hero imagery on Acme's flagship publication landing pages
  (signature treatment is part of the brand's editorial credibility).
- Profile photography of named individuals (producers, advisors,
  Acme team).
- Long-form feature photography where the documentary intent is
  load-bearing.

Acme uses AI image generation for:

- Section dividers and atmospheric backgrounds in newsletters and
  decks.
- Social cards where speed-to-publish matters more than provenance.
- Concept illustration in editorial when the subject is abstract
  (a market shift, a forward-looking scenario) and stock imagery
  cannot provide it.
- Internal artifacts (sales decks, internal presentations, working
  documents).

When a use case is ambiguous, Acme defaults to commissioned over
generated.

## Relationship to design/photography-treatment.md

`design/photography-treatment.md` is Acme's authoritative visual
baseline for HUMAN-shot photography. This layer is consistent with
that baseline — same subject discipline, same color sensibility,
same compositional defaults — but addresses the AI-generation
surface specifically. Style anchors in `style.md` cite the
photography-treatment file via the `photography_treatment_ref:`
frontmatter field; conflicts between the two files are a signal
one of them needs an update.

## Relationship to assets/_manifest.md and design-tokens.md

Reference, don't redeclare:

- Logo clear-space rules and minimum sizes live in
  `assets/_manifest.md`. `brand-overlays.md` cites the manifest;
  it does not restate clear-space values.
- Brand color values live in `design-tokens.md` (and, when present,
  `ui-tokens/`). `brand-overlays.md` references token names by name
  (e.g., `--brand-primary`); it never declares hex values.

## How downstream tools (and AI agents) consume this layer

An AI agent producing imagery for Acme MUST:

1. Load `style.md` and resolve the `photography_treatment_ref:` for
   visual baseline anchors.
2. Pick a subject from `subject-matter.md`'s `themes` array (or, when
   the body specifies, from the prose guidance) and verify the
   subject is not in `forbidden_themes`.
3. Append every entry in `negative-prompts.md`'s
   `universal_negatives` array to the generation request.
4. When the generated image will contain people, apply the
   conventions in `people.md`.
5. When the image will carry brand overlays, apply the rules in
   `brand-overlays.md` (which in turn reference
   `assets/_manifest.md` and `design-tokens.md`).
6. Capture the provenance fields in `provenance.md`'s
   `required_when_published` array before any public surface ships
   the image.

Tools that cannot honor a rule SHOULD emit a warning rather than
silently substituting a default.

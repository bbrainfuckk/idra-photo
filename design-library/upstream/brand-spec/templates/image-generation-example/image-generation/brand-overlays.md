---
type: image-generation-overlays
version: "1.0"
status: sample
last_updated: 2026-05-10
assets_manifest_ref: assets/_manifest.md
---

# Image generation — Brand overlays (Acme Regenerative Media)

## Logo placement on generated imagery (or never)

Acme places the wordmark on generated imagery when the surface is
attributable to Acme's brand (social cards, newsletter hero,
deck-slide title imagery). Acme does NOT place the wordmark on:

- Inline editorial imagery within an article (the article surface
  carries the brand; the inline image does not need to).
- Concept illustration accompanying a feature (the visual point is
  the illustration, not the brand).
- Internal artifacts (sales decks for live presentation, working
  documents).

When the wordmark is placed:

- **Position:** lower-left or lower-right corner.
- **Clear-space and minimum-size:** see `assets/_manifest.md` —
  Acme uses the canonical clear-space rule from the manifest. This
  file does NOT restate those values. (Validators warn when
  brand-overlay rules look like duplication of manifest content.)
- **Color:** wordmark in white over imagery with sufficient
  darkness; in `--brand-primary` over light imagery. When neither
  works without compromising legibility, add a subtle 30%-opacity
  brand-color gradient over the corner where the wordmark sits.

## Watermark conventions

Acme does NOT watermark generated imagery (no diagonal text-tile
overlay, no center "AI-generated" stamp). Provenance is captured
in metadata per `provenance.md` and disclosed via caption or alt
text on user-facing surfaces, not via visual watermark.

## Brand color overlays (gradient, tint, post-processing)

When generated imagery needs to carry Acme branding without a
wordmark — typically newsletter section hero or social card hero
where text overlay needs contrast — apply:

- **Lower-third gradient overlay:** `--brand-primary` at 0% opacity
  at top, `--brand-primary` at 50% opacity at bottom, blended over
  the lower third of the frame. Provides text-overlay contrast
  without dominating the image.
- **Corner-only gradient (alternative):** `--brand-primary` to
  `--brand-secondary` radial gradient anchored bottom-right,
  fading to transparent within ~30% of the frame width. Used when
  the wordmark is placed in that corner.

Acme NEVER applies:

- Full-frame brand-color tint or duotone (reads as 2010s editorial
  gimmick; off-brand for Acme's documentary register).
- Heavy color grading that pulls the image away from naturalistic
  documentary color (see `style.md` "Visual goal").

Token references: `--brand-primary` and `--brand-secondary` MUST
resolve to tokens defined in Acme's `design-tokens.md`. This file
NEVER declares hex values. (Validation rule
`image-gen-design-token-references-resolve` enforces.)

## Attribution text on user-facing imagery

When a generated image ships to a user-facing surface, Acme appends
attribution to the caption or alt-text per the labeling convention
declared in `provenance.md`. Visual attribution overlay on the
image itself is not Acme's convention; the disclosure happens in
the surrounding caption text, not in pixels.

## References to assets/_manifest.md and design-tokens.md

This file references but never restates:

- `assets/_manifest.md` — clear-space rules, minimum sizes,
  wordmark file paths, the `wordmark:` frontmatter block (canonical
  spelling, ASCII fallback, typeface).
- `design-tokens.md` — `--brand-primary`, `--brand-secondary`, and
  any other token names appearing in this file's body.

Conflicts between this file and the referenced files are a signal
one of them needs an update; this file is NEVER the source of
truth for clear-space or color values.

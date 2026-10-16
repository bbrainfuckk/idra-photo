---
# (v1.2.1) Optional wordmark metadata. Omit this whole block if the brand
# has no wordmark (icon-only or no logo). When present, `text` is required;
# `text_ascii` is required only when `text` contains non-ASCII characters.
wordmark:
  text: "Acme"          # canonical glyph sequence as it appears in the logo
  text_ascii: "Acme"    # ASCII fallback (equal to `text` here because it is pure ASCII)
  # Non-ASCII example — if the brand wordmark were "grāmatr" (macron on the 'a'),
  # text would be "grāmatr" and text_ascii would be "gramatr". The macron is
  # load-bearing for the canonical spelling; in CLI / URL / package-name
  # contexts that don't support non-ASCII, the ASCII fallback applies. See
  # vocabulary.md for any two-spelling rule the brand maintains.
  typeface: "Outfit"    # font family the wordmark is set in
  weight: 600           # numeric font weight
  case: "titlecase"     # lowercase | uppercase | titlecase | mixed
  glyph_notes: |
    No special glyphs. (When the wordmark contains diacritics, ligatures,
    or any non-obvious character, document here what carries meaning and
    when the ASCII fallback applies.)
---

# Asset Manifest

Approved brand assets. Each entry includes filename, usage context, and any constraints.

## Logos

TODO — list approved logo files (e.g., `logo-primary.svg`, `logo-mark.png`).

### Format preference — PNG accepted, SVG preferred for future additions

PNG (or other raster) is an **accepted** brand asset format. Many brands
operate cleanly on PNG-only across web headers/footers, email, social
profile/cover images, and decks at standard resolutions. Years of
operation on PNG-only is evidence of fitness, not a deficit.

**SVG is preferred for any future logo additions or replacements** — when
source files become available. SVG matters when:

- Scaling beyond native resolution (conference signage, full-bleed slide
  titles, billboards, large-format print)
- Programmatic recoloring (single-color knockouts, brand-tinted variants
  without re-exporting)
- Vector ops in design tools (masking, animation, splitting wordmark from
  icon)
- Print workflows demanding resolution-independence

**PNG remains the right choice** for email (SVG support is patchy in
Outlook), social profile/cover images (every platform expects raster),
and any context bounded to the existing PNG resolution.

**If/when original vector source becomes available**, drop the SVG
alongside the PNG in `assets/` and add a corresponding row to the table
above. Both formats coexist; downstream tools choose based on the
consumption context.

**What we do not do:** auto-trace PNG to SVG for typographic wordmarks.
Tracing produces noisy polygons that fail to match the original optical
kerning and cannot be re-edited cleanly. Tracing is appropriate for
high-contrast geometric marks only — not typographic ones.

## Imagery

TODO

## Constraints

TODO — clear-space rules, minimum sizes, do/don't.

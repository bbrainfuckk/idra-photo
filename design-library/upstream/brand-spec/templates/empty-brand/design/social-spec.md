---
type: design-spec
status: open
area: social
version: "0.1"
last_updated: "2026-01-01"
---

# Social Design Spec (SAMPLE)

> **This is a sample file.** Replace with your brand's real
> channel-specific design specs, or delete if not applicable. The
> design/ layer holds open questions and channel-specific specs that
> don't fit cleanly in `design-tokens.md` (canonical) or in a channel
> messaging guide (copy-focused). Delete this callout when you replace
> the content.

## Scope

Visual rules for branded social posts on the brand's primary social
channel. Covers static image posts; video specs live in a separate file
when needed.

## Canvas

- **Aspect ratio:** 1:1 (1080×1080) for feed; 9:16 (1080×1920) for
  stories.
- **Safe area:** 80px inset on all sides for feed; 240px top + 320px
  bottom for stories (avoiding platform UI).

## Type

- **Headline:** brand display face, 72-96pt, max 8 words.
- **Body:** brand body face, 32-40pt, max 24 words per slide.
- **Never** stack more than three lines of headline.

## Color

- **Background:** brand neutral-dark (token: `color.surface.brand`).
- **Headline:** brand accent (token: `color.text.accent`).
- **Body:** brand neutral-light (token: `color.text.primary`).

## Logo

- Bottom-right corner, 120px wide, brand-mark only (not full logotype).
- Always white at 80% opacity over dark backgrounds.

## Open questions

- [ ] Do we need a separate spec for carousel posts?
- [ ] Should the brand-mark size scale with canvas size or stay fixed?
- [ ] Approved photo treatment for human subjects — TBD.

## Status

`open` — actively iterating. Do not treat as canonical until status
flips to `closed`.

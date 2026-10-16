---
type: image-generation-negative-prompts
version: "1.0"
status: sample
last_updated: 2026-05-10
universal_negatives:
  - warped hands
  - extra fingers
  - extra limbs
  - distorted face
  - text artifacts
  - watermark
  - signature
  - logo artifact
  - celebrity likeness
  - politician likeness
  - off-brand color cast
  - oversaturated colors
  - HDR look
  - heavy bokeh background
  - studio backdrop
  - white seamless
---

# Image generation — Negative prompts (Acme Regenerative Media)

## Universal negatives (always appended)

Every Acme image generation request appends the
`universal_negatives` array (see frontmatter) to the generator's
negative-prompt input. AI agents producing Acme imagery MUST
include these unless the brand declares an explicit exception
(documented inline at the call site).

The list breaks into three groups:

1. **Generic AI failure modes** — `warped hands`, `extra fingers`,
   `extra limbs`, `distorted face`, `text artifacts`. These are
   model-failure modes that ship with most generators today;
   appending them measurably reduces malformed output.
2. **Likeness exclusions** — `celebrity likeness`,
   `politician likeness`. Acme never publishes generated imagery
   that resembles a public figure; the negative reduces accidental
   resemblance. See `people.md` `forbidden_likenesses` for
   brand-specific additions.
3. **Off-brand visual treatments** — `off-brand color cast`,
   `oversaturated colors`, `HDR look`, `heavy bokeh background`,
   `studio backdrop`, `white seamless`. These are the visual modes
   that pull generated imagery away from Acme's documentary style.

## Common AI failure modes the brand excludes

Beyond the universal list, agents producing Acme imagery SHOULD
also append these contextual negatives when the subject involves:

- **Equipment:** `cartoonish equipment`, `toy tractor`,
  `non-existent equipment configuration` — generators sometimes
  produce equipment that looks correct at a glance but has wrong
  attachment patterns or hybrid-machine renderings that no real
  manufacturer ships.
- **Crops/landscape:** `monoculture stretching to horizon` (Acme's
  audience often runs diversified or rotational systems and the
  endless-monoculture trope is editorially wrong),
  `unrealistic crop maturity` (e.g., mature corn next to bare soil
  in the same frame).
- **People:** see `people.md` for the per-person negatives.

## Style negatives (what Acme is NOT)

Append when the request is at risk of pulling toward an off-brand
register:

- `commercial advertising photography`
- `Instagram aesthetic`
- `aspirational lifestyle photography`
- `agtech corporate`
- `stock photography`

## Per-channel negatives (when applicable)

- **Hero imagery:** `text overlay artifact`, `embedded headline` —
  Acme adds text in post; generated text overlays interfere.
- **Newsletter inline imagery:** `centered subject in frame` —
  newsletter inline imagery typically wraps text on one side, so
  off-center composition is preferred and centered subjects fight
  the layout.

---
type: image-generation-style
version: "1.0"
status: sample
last_updated: 2026-05-10
confidence: medium
photography_treatment_ref: design/photography-treatment.md
aspect_ratios:
  hero: "16:9"
  social-square: "1:1"
  social-story: "9:16"
  linkedin-post: "1.91:1"
  newsletter-section: "3:2"
  deck-slide: "16:9"
---

# Image generation — Style (Acme Regenerative Media)

## Visual goal in one paragraph

Acme's generated imagery should feel like documentary agriculture
photography from a working publication — not stock, not advertising,
not dreamlike. The viewer should believe a real photographer was on
a real farm at a real time of day. Color is naturalistic and
slightly warm; composition is environmental (the subject is in
context, not isolated); the visual era references the FSA
documentary tradition rather than contemporary commercial
agriculture marketing.

## Style anchors

Pair every generation request with at least one of these anchors.
Concrete references outperform abstract adjectives by a wide margin.

- **Film/colorimetry anchors:** Kodachrome 64, Portra 400, Ektar
  100. Slight warm cast, moderate contrast, real-world saturation
  (not punched).
- **Documentary tradition:** FSA-era agricultural photography
  (Dorothea Lange, Walker Evans), updated to contemporary equipment
  and color.
- **Contemporary anchors:** documentary food and agriculture
  photographers working for publications such as
  *Modern Farmer*, *Civil Eats*, *Heated*. Reference image URLs
  live in Acme's internal moodboard at
  `<acme-moodboard-url-redacted>` (real brand instances would link
  the actual URL).
- **What Acme is NOT:** glossy commercial agriculture (Monsanto-era
  ad photography), aspirational lifestyle stock (Instagram
  homestead aesthetic), nor the generic "data network" abstract
  imagery common in agtech marketing.

## Composition defaults

- **Framing:** environmental wide and medium shots dominate. Tight
  details (a hand on a steering wheel, soil in a glove) appear as
  punctuation, not as the primary composition.
- **Depth of field:** moderate. Subject sharp, background readable
  — Acme avoids the heavy bokeh that turns landscapes into
  unreadable blur. Aperture analog: f/5.6 to f/8.
- **Perspective:** eye level or slightly low. Aerial/drone framing
  is allowed for landscape context but should not dominate; the
  viewer should feel they could be standing where the camera was.
- **Negative space:** Acme's hero imagery often carries text
  overlay; compositions SHOULD reserve the lower third or upper
  right for type readability.

## Aspect-ratio defaults by channel

See frontmatter `aspect_ratios:` for the canonical mapping. Channel
guides MAY override with documented justification; the defaults
below are what an agent picks when the surface is ambiguous.

| Channel              | Aspect | Notes                              |
|----------------------|--------|------------------------------------|
| `hero`               | 16:9   | Above-the-fold landing imagery.    |
| `social-square`      | 1:1    | LinkedIn/Instagram feed cards.     |
| `social-story`       | 9:16   | Instagram/LinkedIn story format.   |
| `linkedin-post`      | 1.91:1 | LinkedIn link-preview card.        |
| `newsletter-section` | 3:2    | Inline section dividers.           |
| `deck-slide`         | 16:9   | Sales / editorial deck imagery.    |

## Lighting and time-of-day conventions

- **Default time of day:** golden hour (60-90 minutes after sunrise,
  60-90 minutes before sunset) or overcast soft light. Midday harsh
  shadow is acceptable when the subject is equipment in working
  context (Acme's editorial position is "this is what a real
  workday looks like"); midday harsh shadow on a person's face is
  avoided.
- **Direction:** side or back light dominates. Front-flat lighting
  reads as commercial; Acme avoids it.
- **Weather:** acceptable. Generated imagery may show rain,
  overcast, snow, dust. Drama is welcome; sterile clear-blue-sky
  imagery is not Acme's editorial position.

## When to deviate from defaults

- **Concept illustration** for editorial features on abstract
  subjects (a market shift, a regulatory change, a forward
  scenario) MAY use illustrative or lightly stylized treatments
  rather than documentary realism. The treatment SHOULD be
  consistent within a single feature.
- **Internal artifacts** (sales decks, working presentations) MAY
  relax style anchors when speed-to-draft matters more than
  editorial credibility. The provenance and people-depiction rules
  still apply.

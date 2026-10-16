---
type: image-generation-subjects
version: "1.0"
status: sample
last_updated: 2026-05-10
themes:
  - working-agriculture
  - rural-landscape
  - working-equipment
  - agricultural-production
  - rural-main-street
  - producer-portrait-environmental
forbidden_themes:
  - urban-tech-stock
  - generic-server-room
  - smiling-headset-rep
  - team-around-laptop
  - abstract-network-mesh
  - aspirational-homestead-lifestyle
  - glossy-commercial-agriculture
---

# Image generation — Subject matter (Acme Regenerative Media)

## What the brand depicts

Acme's editorial subject is American agriculture as it actually is —
working farms, working equipment, working people, working
landscapes. Generated imagery SHOULD draw from these themes:

- **Working agriculture** — row crops, pastures, orchards,
  vineyards, livestock operations in active use. Real seasons, real
  weather.
- **Rural landscape** — agricultural geography in context. Field
  edges, creek bottoms, windbreaks, county roads, grain elevators,
  rural-town main streets.
- **Working equipment** — tractors, combines, sprayers, irrigation
  systems, livestock handling facilities, soil-sampling tools — in
  use, dirty from work, not staged.
- **Agricultural production** — soil close-ups, growing crops,
  harvest in progress, post-harvest processing. The stages of the
  production cycle.
- **Rural main street** — small-town agriculture-economy contexts:
  the co-op, the implement dealer, the diner, the county fair.
- **Producer portraits, environmental** — farmers, ranchers, crop
  advisors photographed in their working environment, not in studio
  or on white seamless. See `people.md` for depiction conventions.

## What the brand never depicts

These themes appear nowhere in Acme imagery, generated or
commissioned. Validators warn if a generation request or generated
image carries a theme matching the `forbidden_themes` array.

- **Urban-tech stock** — open-plan offices, laptops on raised
  desks, "team huddle around a screen." Acme's audience is rural;
  the subject matter MUST reflect that.
- **Generic server-room imagery** — racks of blinking lights, blue
  LED corridors. This is the visual cliché of agtech marketing
  Acme exists to differentiate from.
- **Smiling-headset rep** — call-center customer-service stock,
  generic "support" imagery. Not Acme's audience.
- **Team-around-a-laptop** — the universal SaaS marketing cliché.
- **Abstract network mesh** — the "data points connecting" stock
  graphic that became the default agtech hero in the late 2010s.
  Acme rejects this entire visual register.
- **Aspirational homestead lifestyle** — Instagram-aesthetic
  hobby-farming imagery. Acme's audience is commercial agriculture,
  not lifestyle.
- **Glossy commercial agriculture** — Monsanto/Bayer/Corteva-style
  ad photography (perfect crops, perfect equipment, perfect
  lighting). Acme is editorial, not advertising.

## Subject treatment by channel

- **Hero imagery on flagship landing pages:** preference for
  commissioned over generated. When generated, the subject SHOULD
  be a landscape or equipment-in-context shot, not a person —
  people-imagery on flagship hero is reserved for commissioned
  work.
- **Newsletter section dividers:** generated imagery is acceptable
  for any of the canonical themes; landscape and equipment-detail
  themes work best in the newsletter aspect ratio.
- **Social cards:** generated imagery is acceptable for any
  canonical theme. Working-agriculture and rural-landscape themes
  perform best in 1:1 and 1.91:1 cards.
- **Concept illustration in editorial:** when the subject is
  abstract (a market shift, a policy change), generated illustration
  MAY depart from the canonical themes — see `style.md` "When to
  deviate from defaults."

## Working hypothesis vs canonical (when in flux)

The themes above are Acme's canonical subject matter as of the
file's `last_updated` date. When the brand is in flux on a
particular theme — e.g., "Acme is reconsidering whether to depict
livestock operations involving CAFOs" — the file SHOULD say so
explicitly, in the spirit of `lean-media-brand`'s
`design/photography-treatment.md` "Working direction" section. Open
positions are documented honestly; the brand does not pretend a
question is settled when it is not.

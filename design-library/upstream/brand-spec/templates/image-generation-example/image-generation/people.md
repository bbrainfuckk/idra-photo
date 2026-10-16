---
type: image-generation-people
version: "1.0"
status: sample
last_updated: 2026-05-10
age_range: "working-age adults, 25-70; older producers (60-80) acceptable when context is generational/legacy"
diversity_intent: "reflect-customer-base — US Midwest and Plains agriculture demographics; intentional inclusion of producers of color, women producers, and Indigenous producers underrepresented in conventional ag imagery"
forbidden_likenesses:
  - celebrity
  - politician
  - named-competitor-employee
  - named-customer-without-written-consent
  - identifiable-private-individual-without-release
---

# Image generation — People (Acme Regenerative Media)

## When the brand depicts people at all

Acme generates people imagery for:

- Newsletter section dividers and social cards where a producer
  figure (anonymous, generic) carries an editorial point.
- Concept illustration when the editorial point is about people
  (e.g., "a generation of producers transitioning to regenerative
  practices").
- Internal artifacts (decks, working documents).

Acme does NOT generate people imagery for:

- Hero imagery on flagship landing pages — those are commissioned.
- Profile imagery of named individuals (producers, advisors, Acme
  team) — always real photography, never generated.
- Any context where the image will be used to imply endorsement,
  testimony, or quotation by a real person.

## Age range and life-stage conventions

- **Default:** working-age adults, roughly 25-70.
- **Acceptable extension:** older producers (60-80) when the
  editorial subject is generational transition, succession, legacy
  practice, or experience.
- **Generally avoided:** children, adolescents. Acme's audience is
  commercial producers; depicting children in working agricultural
  settings carries safety, child-labor, and regulatory connotations
  Acme prefers to navigate via commissioned imagery only.
- **Generally avoided:** college-age/young-adult-only framing
  (overrepresented in commercial agriculture marketing as
  "the future of farming"; underrepresents who actually runs
  US agriculture today).

## Diversity intent

Acme's editorial position is that conventional agriculture imagery
under-represents the actual diversity of American producers.
Generated imagery SHOULD reflect the customer base Acme serves and
the broader demographic reality of US agriculture:

- Producers of color (Black, Latino/Hispanic, Asian American
  producers are all present in real US agriculture and
  underrepresented in stock).
- Women producers (operate or co-operate roughly 36% of US farms;
  underrepresented in equipment and field imagery).
- Indigenous producers (tribal land managers, Indigenous-owned
  ranching and farming operations).

The intent is editorial accuracy, not tokenism. Generators that
produce a single "diverse" image when the request is for a single
producer SHOULD pick from the underrepresented categories
proportionally over a working set, not insert visible diversity
into every individual frame.

## Attire, setting, and activity conventions

- **Attire:** working clothes appropriate to the depicted activity
  and season. Boots, jeans, work shirts, jackets in cold seasons,
  sun-protective layers in summer. Avoid pristine attire (looks
  staged) and avoid the costumey "farm hat" tropes.
- **Setting:** the working environment (field, pasture, barn,
  shop, equipment cab). Avoid studio, white seamless, and
  generic-office contexts.
- **Activity:** the person is doing something — operating
  equipment, evaluating soil, walking a field, working livestock.
  Avoid posed-arms-crossed and posed-leaning-on-fence stock
  conventions.

## Forbidden likenesses (categories and named individuals)

Acme never generates imagery resembling:

- **Celebrities** (universal — see negative-prompts.md).
- **Politicians** (universal — see negative-prompts.md).
- **Named employees of competitor publications or competitor
  agtech vendors.**
- **Named Acme customers**, named producer-subjects of past
  editorial coverage, or any identifiable private individual
  Acme has not obtained written consent from.

When in doubt, Acme treats the resemblance as forbidden.

## Consent and release conventions

When generated imagery is intended to depict a fictional but
human-readable individual (e.g., a recurring illustrative figure
in editorial), Acme captures the generation parameters in
`provenance.md` and tags the resulting image as
`fictional-composite` in the asset DAM. Generated imagery is
never represented as a real person; captions and alt-text
acknowledge the AI-generated nature when the surface is
user-facing.

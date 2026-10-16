---
type: framework
version: "1.0"
status: sample
methodology_provenance:
  name: "Know Yourself, Know Your Customer (KYKC)"
  short_name: KYKC
  originator: "Brian Handrigan"
  developed_at: "grāmatr (digital marketing agency)"
  developed_year: 2005
  refined_through: "20 years of agency, adtech, and AI work"
  continuity_note: |
    The grāmatr brand identity has been continuous from 2005 through the
    present. The methodology was developed at the original grāmatr
    digital marketing agency and has been refined — not rebranded —
    across the agency, adtech, and AI eras of the same brand.
  references: []
  notes: |
    KYKC is open-sourced into brand-spec deliberately. Brands MAY adopt
    the methodology and the attribution as-is; brands MAY also override
    the methodology block if they have their own discipline that this
    layer operationalizes.
---

# Journey — Framework

## The discipline (KYKC)

**KYKC — Know Yourself, Know Your Customer.** Two halves, both
required.

**Know Yourself** is the inventory side: every capability, claim,
proof point, and constraint your brand can credibly stand behind. Most
brands document this implicitly across `identity.md`, `voice.md`,
`vocabulary.md`, `proof/`, and `data/`. The self-knowledge side of
KYKC is already covered by other layers in brand-spec; this layer does
not re-document it.

**Know Your Customer** is the cognition side: the prospect's mental
state at each stage of their thinking, in their own words, using their
own concept boundaries. This is what the journey layer captures. The
discipline is to **lead with the customer's cognition, not your
capability inventory** — write content that meets prospects where they
are, then bridge to what you can credibly offer, never the reverse.

When brands skip the customer half, they default to talking about
themselves. The output reads as feature-pitch instead of problem-fit.
KYKC exists to keep the customer half load-bearing.

## The artifact (CognitiveJourney)

The **CognitiveJourney** is the structured artifact that operationalizes
the customer side of KYKC. It is an ordered list of cognitive stages
that maps the prospect's mental journey from problem recognition to
post-decision reinforcement.

The 5 canonical stages are:

1. **`problem-recognition`** — the prospect realizes they have a
   problem worth solving.
2. **`information-seeking`** — they begin learning about the problem
   space; they are not yet evaluating vendors.
3. **`option-evaluation`** — they are comparing approaches, vendors,
   or build-vs-buy.
4. **`decision-validation`** — they have a leading choice and are
   reducing risk before committing.
5. **`post-decision`** — they have decided; they are onboarding,
   advocating, or quietly regretting.

These 5 are a **canonical-with-extension** default. Brands MAY add
stages (e.g., a pre-problem-recognition `latent-need` stage for
category-creating products), reorder them, rename them, or omit them.
The canonical slugs exist so downstream tools — FAQ-schema generators,
future stage-aware messaging variants, AI agents producing on-stage
content — can recognize stages without an alias map. When you rename a
canonical slug, the `journey-canonical-stage-warn` validator emits a
soft signal so consumers know to expect a custom taxonomy.

Each stage is captured at two granularities:

- **`journey/stages.md`** — the at-a-glance overview. Slug, label, and
  order for every stage; brands MAY include a brief description here.
- **`journey/stages/<slug>.md`** — the per-stage detail file. Captures
  `description`, `triggers`, `hurdles`, `mental_vocabulary`,
  `questions_asked`, and `content_goal`. These are the load-bearing
  fields — they are what AI tooling reads to generate on-stage content.

## Methodology origins

KYKC and CognitiveJourney were developed by **Brian Handrigan** at the
**grāmatr digital marketing agency, circa 2005**, and refined across
**20 years** of agency, adtech, and AI work.

The grāmatr brand identity has been continuous across that arc. The
agency that originated KYKC is the same brand that today builds AI
context-engineering tooling under the grāmatr name — not a rebrand, but
a continuous brand carrying the same methodology through three industry
eras (agency → adtech → AI). Each era stress-tested KYKC in a different
operating environment: the agency era proved it on B2B and B2C client
work; the adtech era proved it under the constraint of paid-media
attribution; the AI era proved it as the ground-truth signal that
generative tools need to write on-prospect-cognition content.

Bringing KYKC into brand-spec in v1.4 is the first time the methodology
has been open-sourced with explicit, structured attribution. The
`methodology_provenance:` convention exists so any methodology brought
into the spec from here forward gets the same treatment: credible
originator, real history, no false claims.

The two `methodology_provenance:` blocks in this layer are co-equal.
The block on this file (`_framework.md`) attributes **KYKC, the
discipline**. The block on `stages.md` attributes **CognitiveJourney,
the artifact** — the structured shape that operationalizes the
discipline. They share an originator and a year, but they are
intellectually distinct contributions and the spec attributes them
distinctly.

## Why this matters for AI search

The journey layer's payoff is mechanical, not philosophical. AI search
and retrieval systems reward content that matches the prospect's actual
language, in the actual shape of their actual questions, at the actual
stage of their thinking. The journey layer's frontmatter fields map
directly onto AI-search mechanics:

- **`mental_vocabulary[]` → semantic match to query embeddings.**
  Prospects search using their own words, not your marketing
  vocabulary. Embedding models score similarity in the prospect's
  semantic space, not yours. Content built from `mental_vocabulary`
  surfaces in semantic-search and RAG-retrieval results that
  vocabulary-driven content misses entirely.

- **`questions_asked[]` → FAQPage schema → AI Overview citations.**
  Verbatim prospect questions are the cleanest input to schema.org
  `FAQPage` markup, which is itself the cleanest input AI Overviews
  use to assemble answer snippets. Content with `questions_asked`
  rendered as on-page Q&A is structurally optimized to be cited in
  generative answers.

- **`triggers[]` → problem-recognition queries.** The events that move
  a prospect into a stage are the events that drive their search
  behavior. Cataloguing triggers gives content teams a target list of
  top-of-funnel intent queries to address — queries that vocabulary-
  driven keyword research routinely misses because they are
  problem-shaped, not solution-shaped.

- **`hurdles[]` → objection-handling queries.** What prevents a
  prospect from advancing is what they search for to overcome the
  block. Hurdles are the source for objection-handling content (the
  "but what about X" landing pages and FAQs that move prospects from
  one stage to the next).

- **`content_goal` → forces content design from prospect mental
  state.** Without a stage-specific goal, content tends to default to
  a single all-purpose pitch. The `content_goal` field forces the
  author to declare what this stage's content is meant to accomplish
  in the prospect's cognition, not in the brand's funnel metrics.

The brand-spec position: AI search is not a separate channel to add to
the channel guide list. It is the consequence of every other channel
being read by AI agents. The journey layer is the input that lets the
brand show up in the AI-mediated layer of every other channel.

## How to use this layer

A few practical disciplines for brand authors:

- **Stages should be authored from real prospect interviews, not
  invented.** If you cannot point to the source interview for a
  given `triggers` or `hurdles` entry, you are guessing. Guesses
  produce on-brand-sounding content that does not match prospect
  cognition. The journey layer rewards primary research and punishes
  marketing-team consensus.

- **`mental_vocabulary` is the prospect's words, not yours.**
  This is the one place in brand-spec where the brand's preferred
  vocabulary explicitly does not apply. If your `vocabulary.md`
  forbids "platform" but prospects use "platform" to describe what
  they are looking for, "platform" belongs in
  `mental_vocabulary`. The two fields serve opposite purposes:
  `vocabulary.md` governs how the brand speaks; `mental_vocabulary`
  records how the prospect speaks. Downstream tools know to keep
  them separate.

- **`questions_asked` should be verbatim.** Capture the exact phrasing
  from interview transcripts. Resist the urge to clean up grammar or
  to merge similar questions into one canonical form. The verbatim
  shape is what FAQPage schema and AI-overview citation surfaces
  need.

- **Start with `stages.md` plus 1-2 detailed per-stage files.**
  Filling out all 5 stages with rich detail on day one is
  unrealistic. Authoritative slug/label/order for all 5 stages goes
  in `stages.md`; detailed `triggers`/`hurdles`/`mental_vocabulary`/
  `questions_asked` per-stage files come as you accumulate interview
  evidence. The `journey-stages-monotonic-order` rule applies to the
  `stages.md` declaration, not to the per-stage file count.

- **Revisit when prospect cognition shifts.** Markets move; new
  triggers emerge (regulation, AI disruption, macro pressure); old
  hurdles fade. Treat the journey layer like the proof layer — it
  decays, and stale stages are worse than missing stages. A `corpus_pulled`
  -style freshness convention may land in a future minor; for now,
  use `last_updated` on each per-stage file and review yearly.

## Relationship to other layers

The journey layer sits beside `personas/` and feeds `messaging/`:

- **Personas describe WHO** — audience × role cells in a matrix.
  `enterprise-champion`, `mid-market-buyer`, `smb-end-user`.
- **Journey describes WHEN/WHERE in their thinking** — stages in
  cognitive order. `problem-recognition`, `option-evaluation`,
  `post-decision`.
- **Messaging eventually grows journey-stage variants** — files
  shaped like `messaging/for-{audience}-at-{stage}.md` that pair a
  persona with a stage, as a Phase 2 evolution of the messaging
  layer. Phase 2 is NOT in v1.4. The `journey-stage-slug-resolves`
  validator rule is `warn`-only in v1.4 because the cross-layer
  reference syntax has not been finalized.

A persona without a journey is a static description. A journey without
personas is a generic funnel. The two layers compose into a matrix:
**which persona, at which stage, needs which content** — and the
matrix is what stage-aware messaging variants will index in a future
phase.

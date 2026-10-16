# brand-spec

**A portable, machine-readable representation of a brand — designed to be loaded by AI agents.**

`brand-spec` defines the file/folder layout, frontmatter conventions, and validation rules a brand repo follows so any AI tool can clone it, parse it, and immediately write on-brand. It is the **brand context window for the LLM era**: voice, vocabulary, personas, design tokens, validated examples, and prompt templates, all in one consistent shape.

The schema lives in [`brand.yaml`](./brand.yaml). It was reverse-engineered from a real production brand repo, not invented top-down — every field in the schema is backed by a working example.

## For AI agents

If you are an AI agent that needs to operate as a brand:

1. **Clone the brand repo.** Any repo conforming to this spec is self-describing.
2. **Read `brand.yaml`** to discover which layers the brand provides.
3. **If `agent-context.md` exists, load it first.** It is a 2-4K-token digest of the brand designed to fit a single prompt window. Its frontmatter `priority_layers` tells you which full layers to load next when you have more budget.
4. **Otherwise, load layers in priority order:**
   - **First (always):** `identity.md`, `voice.md`, `vocabulary.md` — who the brand is, how it sounds, words to use and avoid.
   - **Next:** `design-tokens.md`, `personas/` — visual system and audience definitions.
   - **Last (for few-shot anchoring):** `examples/`, `prompts/` — validated reference outputs and content-type briefs.
5. **Respect frontmatter.** Fields like `validated: true` on a prompt mean the listed examples are trustworthy anchors. Fields like `status: open` on a design spec mean the answer is not yet settled.
6. **Build a reference graph generically (v1.7+).** Any frontmatter field whose name matches the regex `^[a-z_]+_refs?$` is a cross-layer reference (singular `*_ref` for a single value, plural `*_refs` for arrays). Resolve each value as a layer name, file path, design-token name, `path#fragment`, or URL. When a file declares an optional top-level `references:` block, each entry additionally carries `kind` (`requires` | `recommends` | `cites`) so you can weight edges in the graph. Together they let an agent walk a brand without knowing per-layer naming. See `conventions.cross_layer_references:` in `brand.yaml` for the full schema.

The repo is the LLM context. No API call required.

## For tools

`brand-spec` is consumer-agnostic. Any tool that wants to validate, ingest, render, or generate against a brand can read `brand.yaml` and walk the repo.

[grāmatr Studio](https://github.com/gramatr) is the reference implementation: it ingests brand-spec-conforming repos, validates them against `brand.yaml`, and writes the parsed brand into runtime tables. But the spec is open — a CMS, a design tool, a code generator, or a custom in-house pipeline can consume the same repo with no Studio dependency.

## Agent context layer

`agent-context.md` is the entry point for context-constrained agents. It is **recommended, not required**: small brands can skip it and let agents load the full layer set; larger brands benefit from a curated digest that compresses the brand into one prompt window.

Frontmatter:

```yaml
---
schema_version: 1
summary: "One paragraph describing the brand: who they are, who they serve, how they sound."
priority_layers:
  - identity
  - voice
  - vocabulary
  - personas
  - examples
---
```

Body (target ≈ 2-4K tokens):

- Voice in one paragraph
- Top 5 vocabulary do/don't items
- Persona summary (matrix shape + the cells that matter most)
- Anything else essential — proprietary concepts, what the brand is NOT, hard tone rules

Think of it as the brand's `CLAUDE.md`: the file you load when you can only load one file.

## What's new in v1.7

A canonical **cross-layer reference syntax** lands as a new
structural primitive. Cross-layer references had been invented
per-layer six times (`agent-context.priority_layers`,
`voice/registers.applies_to`, `source_authority.upstream`,
journey-stage refs, `data-viz/colors.md` token refs,
`image-generation/style.md` and `brand-overlays.md` refs); v1.7
lifts the pattern into one convention so future cross-layer needs
reuse one shape and validators can ship one generic resolver
instead of N per-layer rules. Closes RFC
[`#31`](https://github.com/gramatr/brand-spec/issues/31).

Two co-equal mechanisms (Hybrid B + C from the RFC):

- **Frontmatter naming convention.** Any field whose name matches
  the regex `^[a-z_]+_refs?$` is treated as a reference. Singular
  (`*_ref`) for one value; plural (`*_refs`) for arrays.
  Low-ceremony — recommended for most cases.
- **Optional `references:` block.** When a reference needs richer
  metadata (`kind: requires` / `recommends` / `cites`, structured
  layer-entries selection, free-text edge notes), authors opt into
  the structured frontmatter block. Optional — most refs use the
  naming convention alone.

Five resolvable target types: `layer`, `file`, `token`,
`path_with_fragment`, `url`. Inline body-reference syntax
(`{{ ref:name }}`) and URI-scheme pointers (Option D from the
RFC) are intentionally NOT in v1.7 — frontmatter refs only;
URI-scheme is v2 territory.

Three new validation rules:

- `cross-layer-ref-target-resolves` (error) — `*_ref` / `*_refs`
  fields MUST resolve. Token references emit `warn` (not `error`)
  until the body-parse subsystem lands.
- `structured-references-kind-valid` (error) — `references:` block
  entries MUST declare valid `type`, `target`, and
  `kind` (`requires` | `recommends` | `cites`).
- `legacy-ref-field-migration-recommended` (info) — when a known
  legacy reference field is present, the validator advises
  migration to the convention. Brands MAY ignore the advisory
  indefinitely; legacy fields keep validating.

Semver: **MINOR bump** per `VERSIONING.md`. A new structural
primitive is the canonical minor-bump example. v1.6.1 brands
(NEXT90, gramatr-brand, lean-media-brand) validate cleanly against
v1.7.0 with zero changes — verified by inspection. The 6 existing
invention sites stay as-is in v1.7.0; each migrates in a separate
v1.7.x patch so reviewers can audit independently. Validator
runtime resolution of the new generic rules is post-merge work in
`gramatr/brand-spec-validator`.

See [`templates/cross-layer-refs-example/`](./templates/cross-layer-refs-example/)
for the worked example.

## What's new in v1.6.1

Patch release. The existing `design/` layer is extended with optional
**iconography conventions** — an `iconography.md` file capturing icon
set, sizing, color treatment, stroke vs fill, spacing, and one-set
exceptions, plus an optional `design/icons/` directory for custom icon
sources. No new top-level layer, no new required fields. v1.6.0
brands validate cleanly against v1.6.1 with zero changes.

The release also formalizes the **decorative-vs-functional
distinction**: gradient or decorative "icons" that read as brand
imagery (e.g., section-decoration gradient SVGs on a marketing site)
belong in `assets/_manifest.md` and are governed by the assets layer.
Functional UI icons that participate in the icon system belong in
`design/iconography.md`. Brands SHOULD document the distinction
explicitly when both surfaces are present. Real example: lean-media's
`custom-icon_*-grad.svg` files (audience, farm characteristics,
location, Venn diagram) are decorative gradient illustrations that
already live conceptually in the assets manifest; the implicit
functional iconography (favicon, any future UI surface) would land in
`design/iconography.md`.

Three new validation rules ship with the extension:

- `iconography-set-resolves` (info) — when `icon_set.name` is
  `custom`, the `design/icons/` directory SHOULD exist with at least
  one icon file and a `_manifest.md`. Public libraries (lucide,
  material-symbols, heroicons, etc.) need no local files.
- `iconography-sizing-references-resolve` (warn) — sizing values
  MUST resolve to design-tokens (or `ui-tokens/`) by name; never
  redeclare px or rem values here. Mirrors the v1.5
  `data-viz-color-tokens-resolve` and the v1.6
  `image-gen-design-token-references-resolve` rules.
- `iconography-decorative-distinction-recommended` (info) — when
  both functional iconography and decorative gradient icons exist
  in a brand, `iconography.md` SHOULD include a "Decorative vs
  functional" body section spelling out which assets fall on which
  side.

Semver: **PATCH bump** per `VERSIONING.md`. This is an extension of
an existing layer with optional fields — not a new capability domain.
The decorative-vs-functional distinction reuses the existing assets
layer (no new structure on that side); the iconography file extends
`design/` with optional content. See
[`templates/empty-brand/design/iconography.md`](./templates/empty-brand/design/iconography.md)
for the worked example.

## What's new in v1.6

A new top-level `image-generation/` layer brings **AI image
generation conventions** into brand-spec as a first-class capability
domain. The layer is `recommended: true, required: false`. v1.5
brands validate cleanly against v1.6 with zero changes — no required
field was added to any existing layer.

The layer was driven by the audit (#12 / #13) finding that the
existing `prompts/` layer covers prose generation only and has no
slot for visual-generation prompts (Midjourney / DALL-E / Imagen /
Flux), which have very different structure: style anchors, negative
prompts, aspect-ratio defaults, people-depiction rules, and
provenance concerns. The `design/photography-treatment.md` files
that some brands carry document HUMAN-shot photography intent — they
are a useful visual baseline, but they do not say how to GENERATE
imagery. Two distinct surfaces.

The layer comprises seven files (all optional, six recommended):

- `image-generation/_framework.md` — what this layer covers, when
  to use it vs commission a human shoot, relationship to
  `design/photography-treatment.md`, how downstream tools consume
  the layer.
- `image-generation/style.md` — visual goal, style anchors
  (concrete: film stocks, documentary traditions, named
  photographers), composition defaults, aspect-ratio defaults per
  channel. Optional `photography_treatment_ref:` cross-links to
  the brand's photography-treatment file when one exists.
- `image-generation/subject-matter.md` — what the brand depicts,
  what the brand never depicts. Optional machine-readable `themes:`
  and `forbidden_themes:` arrays for AI agents picking subjects
  from a controlled set.
- `image-generation/negative-prompts.md` — universal-negatives
  array always appended to generation requests, plus brand-specific
  exclusions and per-channel additions.
- `image-generation/people.md` — when and how the brand depicts
  humans, with declared age range, diversity intent, and forbidden
  likenesses. The most ethically loaded slot in the layer; the
  schema documents the fields, brands decide their own positions.
- `image-generation/brand-overlays.md` — logo placement, watermarks,
  brand color overlays, attribution. References
  `assets/_manifest.md` for clear-space and `design-tokens.md` for
  brand colors — never duplicates values.
- `image-generation/provenance.md` — what the brand captures for
  every generated image, what the brand requires before publishing,
  user-facing labeling convention, approval workflow, retention,
  jurisdictional considerations.

The layer is **model-agnostic** in v1.6 — no per-model variants
(`midjourney.md`, `dalle.md`). Per-model files MAY be added in a
future patch when real divergence in prompt syntax surfaces;
brand-spec stays neutral until then.

The layer is **recommended, not required**. Most brands generating
imagery via AI tools benefit; brands using only stock photography or
commissioned shoots MAY skip the layer entirely.

Six new validation rules ship with the layer:

- `image-gen-photography-treatment-link-valid` (warn) — when style.md
  declares a `photography_treatment_ref:`, the referenced file
  MUST exist.
- `image-gen-overlay-manifest-link-valid` (warn) — when
  brand-overlays.md declares `assets_manifest_ref:`, the referenced
  file MUST exist.
- `image-gen-design-token-references-resolve` (error) — token
  references in brand-overlays.md MUST resolve to design-token
  definitions; the layer assigns USAGE to existing tokens, never
  redeclares hex values.
- `image-gen-people-required-fields-when-present` (warn) — when
  people.md exists, it SHOULD declare at least one of `age_range`,
  `diversity_intent`, or `forbidden_likenesses`, OR explicitly
  state in the body that the brand does not generate people
  imagery.
- `image-gen-provenance-required-when-published` (info) — when
  provenance.md declares `required_when_published:`, downstream
  pipelines SHOULD enforce that every published image carries
  those fields. Pipeline-level enforcement; brand-spec validators
  treat as informational.
- `image-gen-framework-recommended` (info) — when any file under
  image-generation/ exists, `_framework.md` SHOULD also exist.

Semver: **MINOR bump** per `VERSIONING.md` (new top-level layer =
new capability domain). The `journey/` (v1.4) and `data-viz/`
(v1.5) layers were the same shape of change. v1.5 brands validate
cleanly against v1.6 with zero changes. See
[`templates/image-generation-example/`](./templates/image-generation-example/)
for a worked example using a hypothetical Acme Regenerative Media
brand (B2B agriculture media publisher; chosen so the template can
demonstrate the cross-link to a photography-treatment file).

## What's new in v1.5

A new top-level `data-viz/` layer brings **charting and data
visualization** into brand-spec as a first-class capability domain.
The layer is `recommended: true, required: false`. v1.4 brands
validate cleanly against v1.5 with zero changes — no required field
was added to any existing layer.

The layer was driven by the audit (#12 / #13) finding that brands
routinely document the same chart guidance two and three times
across `messaging/channel-*.md` files — once per channel that ever
shows a chart. NEXT90's deck, social, and landing-page channel
guides each carry near-identical sections on chart palette, axis
treatment, big-stat formatting, and source citation. With this
layer in place, those rules have a single canonical home and the
channel guides reference it.

The layer comprises seven files (all optional, all recommended):

- `data-viz/_framework.md` — what this layer covers, when to use it
  vs `design-tokens.md`, how downstream tools consume it.
- `data-viz/colors.md` — categorical / sequential / diverging /
  semantic palette assignments. **References design-tokens by name;
  never redeclares hex values.**
- `data-viz/chart-types.md` — per-brand allowed/forbidden chart-type
  policy. The slot is universal; the policy is brand-defined.
- `data-viz/axes-and-grid.md` — origin behavior, gridline
  conventions, tick density, label rotation.
- `data-viz/annotations.md` — big-stat callouts, inline highlights,
  source citation rules. The optional `source_citation_required:
  true` frontmatter flag enforces source citation on numeric
  annotations.
- `data-viz/numbers.md` — currency, percentage, large-number
  abbreviation, precision, locale, negative-number convention.
- `data-viz/tables.md` — header treatment, column alignment,
  empty-cell convention, sort indicators.

The four-family color-role taxonomy (categorical / sequential /
diverging / semantic) follows established information-design
practice — Tableau, IBM Carbon Charts, Material Design Data Viz,
and Observable Plot all use the same shape. Brands may use any
subset; the spec does not prescribe which families a brand must
populate.

Five new validation rules ship with the layer, severities calibrated
to the rule's purpose:

- `data-viz-color-tokens-resolve` (error) — token references in
  `data-viz/colors.md` MUST resolve to design-token definitions.
- `data-viz-no-hex-redeclaration` (warn) — hex literals in
  `data-viz/*.md` belong in `design-tokens.md` instead.
- `data-viz-chart-type-coverage-warn` (warn) — when a brand declares
  a `forbidden:` chart-type list, validators warn if a channel guide
  or prompt references one of the forbidden types.
- `data-viz-annotation-source-required` (warn) — when a brand sets
  `source_citation_required: true`, downstream artifact generators
  must attach citations to numeric annotations.
- `data-viz-framework-presence` (info) — when any data-viz file
  exists, `_framework.md` SHOULD also exist.

Migration recommendation for brands today carrying duplicate chart
guidance in channel files: consolidate into `data-viz/` when next
revisiting those guides. The migration is not forced — channel
files continue to validate cleanly with the prose intact — but the
duplication is a known liability and `data-viz/` is the canonical
home going forward.

Semver: **MINOR bump** per `VERSIONING.md` (new top-level layer =
new capability domain). The `journey/` layer in v1.4 was the same
shape of change; the policy's named examples (`interactions/`,
`taxonomies/`) are also the same shape. v1.4 brands validate
cleanly against v1.5 with zero changes — the data-viz layer is
recommended-not-required, and no required field was added to any
existing layer. See [`templates/data-viz-example/`](./templates/data-viz-example/)
for a worked example using a hypothetical brand (Acme Analytics).

## What's new in v1.4

A new top-level `journey/` layer brings **KYKC (Know Yourself, Know Your Customer)**
and the **CognitiveJourney** artifact into brand-spec as first-class
concepts. KYKC is the discipline; CognitiveJourney is the structured
shape that operationalizes it. Both ship inline as the new layer (NOT a
separately-referenced contract); both are co-equal and attributed
distinctly using a new `methodology_provenance:` frontmatter convention.

The layer captures the prospect's cognitive journey in ordered stages.
The 5 canonical stages — `problem-recognition` →
`information-seeking` → `option-evaluation` → `decision-validation` →
`post-decision` — are a default; brands MAY rename, reorder, add, or
omit. Per-stage detail files capture the prospect's `mental_vocabulary`,
verbatim `questions_asked`, the `triggers` that move them into the
stage, the `hurdles` that prevent advancement, and the stage-specific
`content_goal`. These fields map mechanically onto AI-search surfaces:
mental vocabulary feeds embedding-space retrieval, verbatim questions
feed FAQPage schema and AI Overview citations, triggers shape
top-of-funnel intent capture, hurdles drive objection-handling content.
See [`templates/journey-example/journey/_framework.md`](./templates/journey-example/journey/_framework.md)
for the full mechanical mapping.

The `methodology_provenance:` convention is documented once under
`conventions:` in `brand.yaml` and is applicable to any layer. Required
sub-fields when present: `name`, `originator`, `developed_year`. Other
sub-fields are optional. Co-equal methodologies (e.g., KYKC the
discipline and CognitiveJourney the artifact) get separate blocks, not
a merged one.

KYKC and CognitiveJourney were developed by **Brian Handrigan** at the
**grāmatr digital marketing agency, circa 2005**, and refined across
20 years of agency, adtech, and AI work — the grāmatr brand identity
has been continuous across that arc. This is the first methodology
brought into brand-spec with explicit, structured attribution; the
convention sets the precedent for how future contributed methodologies
(voice-register patterns, channel-guide templates, compliance-gate
frameworks) get attributed: credible originator, real history, no
false claims.

Semver: **MINOR bump** per `VERSIONING.md` (new top-level layer = new
capability domain). v1.3.0 brands validate cleanly against v1.4 with
zero changes — the journey layer is `recommended: true, required:
false`, and no required field was added to any existing layer. See
[`CHANGELOG.md`](./CHANGELOG.md) for the full v1.4.0 entry and the
explicit out-of-scope list.

## What's new in v1.3

Nine additive schema changes surfaced by the second wave of multi-register
voice work (`lean-media-brand` and `gramatr-brand` both shipped multi-
register voices on top of v1.2). All nine close real gaps the brand
authors hit; all nine are backward-compatible with v1.2.1. v1.2.1 brands
validate cleanly against v1.3 with zero changes.

1. **Corpus metadata for register frontmatter** — registers derived from
   an analyzed corpus SHOULD declare `corpus_size`, `corpus_source`,
   `corpus_pulled` (ISO date), and `confidence` (`high`/`medium`/`low`).
   Two real-world brands added these ad-hoc; v1.3 formalizes them so
   downstream agents can tell whether a register's rules are backed by
   50 examples or 2.

2. **Controlled vocabulary for `applies_to` channel slugs (baseline +
   warn)** — `brand.yaml` now publishes a baseline list of canonical
   kebab-case channel slugs under `conventions.applies_to_baseline_slugs`.
   Brands MAY extend with brand-specific slugs; validators warn (do not
   error) on slugs that look like baseline drift (`email` vs
   `marketing-email` vs canonical `marketing-emails`). Convention-only
   in v1.3; full taxonomy enforcement is v2 territory.

3. **Register inheritance rule (formalized).** Registers ADD permissions;
   they do NOT subtract brand-wide constraints. Both real-world brands
   asserted this in prose under "What all registers share"; v1.3 makes
   it a validation rule (see #6).

4. **Quoted-voice exemption pattern** — two co-equal conventions: a
   `contains_quoted_voices: true` frontmatter flag (file-level signal,
   validator-friendly) and a `> Quoted: <attribution>` markdown
   blockquote callout (inline, author-friendly). Validators skip
   voice/vocabulary evaluation inside either.

5. **Body section guidance for register 2+** — for any register beyond
   the primary, the recommended body sections become "What this register
   allows that {primary} does not" and "What is still forbidden
   (inherited)." Documented as recommended structure, not validator-
   enforced.

6. **Vocabulary inheritance enforcement** — new validator rule
   (`register-inheritance-cannot-subtract`, error severity): a term on
   the `vocabulary.md` forbidden list MUST NOT appear in an "allowed"
   body section of any register file. Forbidden terms inside `> Quoted:`
   callouts, "Published Voice Examples" quotes, or "What does NOT fit"
   sections are ignored (illustrative, not register-permissive).

7. **Cross-register precedence (optional frontmatter block)** —
   `voice/README.md` (or `voice/_index.md`) MAY declare a
   `precedence:` block with `default_order` (register slugs in winning
   order) and/or `surface_overrides` (surface slug → winning register
   slug). Validator-friendly equivalent of the prose "Precedence when
   contexts overlap" section both real-world brands document today.

8. **Platform-overlay subsections** — when a register applies to
   multiple platforms with distinct rendering conventions (e.g.,
   `founder-byline` covers blog AND LinkedIn), platform-specific
   conventions (hashtag stacks, emoji budgets, em-dash dividers, CTA
   permissions) get a structured slot via either `platform_overlays:`
   frontmatter or an `On {Platform}` H2 section. Either form is
   acceptable.

9. **"What does NOT fit this register" first-class section** —
   recommended body section for explicit drift-detection negative-space
   documentation (outliers, cut posts, surfaces that look on-register
   but are not). Informational severity; brands MAY omit.

See `brand.yaml` for the full field definitions and validation rules
(IDs `corpus-metadata-recommended`, `corpus-pulled-freshness-warn`,
`applies-to-baseline-warn`, `register-inheritance-cannot-subtract`,
`register-inheritance-doc-recommended`, `quoted-voice-callout-skipped`,
`precedence-references-resolve`, `platform-overlay-keys-recommended`,
`drift-detection-section-recommended`). See
`templates/multi-register-voice-example/` for a worked example
demonstrating items 1, 5, 7, 8, 9 in use.

### Brand-author summary

- **Corpus metadata** — declare `corpus_size`, `corpus_source`,
  `corpus_pulled`, `confidence` on every register file derived from a
  corpus.
- **Inheritance is enforced.** A register cannot un-forbid a term the
  brand-wide `vocabulary.md` forbids. Use a `> Quoted: <attribution>`
  callout (or `contains_quoted_voices: true` frontmatter) to legitimately
  surface a third-party voice.
- **Precedence and overlays are first-class slots.** Document register
  precedence in the `voice/README.md` `precedence:` frontmatter; document
  per-platform overlays in `platform_overlays:` (or in an `On {Platform}`
  H2). Both real-world brands had ad-hoc prose for these; v1.3 gives them
  structured homes.
- **Drift-detection sections** — register files SHOULD include a "What
  does NOT fit this register" section so generation tooling can
  recognize negative-space examples.

## What's new in v1.2.1

Two coupled additive conventions on the assets layer. Both are optional
and backward-compatible — v1.2 brands validate cleanly against v1.2.1
with zero changes.

1. **Asset format preference (PNG accepted, SVG preferred for future).**
   PNG (or other raster) is an accepted format for any logo file. SVG is
   preferred for future additions or replacements when vector source
   becomes available — useful for scaling beyond native resolution,
   programmatic recoloring, vector ops in design tools, and large-format
   print. PNG remains the right choice for email, social profile/cover
   images, and any context bounded to native resolution. Brands MUST
   NOT auto-trace PNG to SVG for typographic wordmarks (tracing
   produces noisy polygons that fail to match optical kerning).

2. **Wordmark structured metadata.** An optional `wordmark:` frontmatter
   block on `assets/_manifest.md` captures the canonical glyph sequence
   (`text`), an ASCII fallback (`text_ascii`, required only when `text`
   contains non-ASCII characters), and metadata about typeface, weight,
   case, and glyph behavior. AI agents and downstream tools can use
   this to render brand-bearing artifacts correctly across surfaces
   that vary in their support for non-ASCII characters.

See the schema's `assets` layer in `brand.yaml` for full field
definitions and `templates/empty-brand/assets/_manifest.md` for the
canonical example.

### Wordmark guidance for AI agents

When generating brand-bearing artifacts (decks, emails, code, social
posts, package metadata), an agent SHOULD read the `wordmark:` block
from `assets/_manifest.md` and apply this precedence rule: `text` is
the canonical form and SHOULD be used wherever the consuming surface
can render it. `text_ascii` is the fallback ONLY when the surface
cannot render the canonical glyphs — typical examples are CLI output
in environments with restricted encodings, URLs, npm package names,
GitHub org slugs, and social handles that reject non-ASCII characters.

Do not silently substitute `text_ascii` when the canonical form works.
If the brand also documents a two-spelling rule in `vocabulary.md`,
defer to that — the wordmark block exists to make the canonical/ASCII
pair machine-readable, not to override editorial guidance.

## What's new in v1.2

Four additive schema changes, all backward-compatible with v1.1:

1. **Multi-register voice.** Brands can now use a `voice/` directory
   with one file per register (e.g., `voice/registers/corporate.md`,
   `voice/registers/engineering.md`) plus a `voice/README.md` index.
   Use this when one brand has multiple distinct on-brand voices that
   vary by channel or context. Single-register `voice.md` (the v1.1
   default) is unchanged. A brand uses one pattern OR the other —
   never both. See [`templates/multi-register-voice-example/`](./templates/multi-register-voice-example/).

2. **Source authority metadata.** Optional `source_authority`
   frontmatter on any file declares whether the file is `canonical`,
   `mirror`, `historical`, or `fixture-only`. Lets validators and
   agents know not to treat an intentionally-stale fixture as truth.
   Defaults to `canonical` when omitted.

3. **File-level visibility classification.** Optional `visibility`
   frontmatter on any file: `public`, `customer`, `internal`, or
   `sales-enablement`. Tools generating public artifacts MUST filter
   out non-public files. Defaults to `public` when omitted.
   Backward-compat: legacy `audience: internal` on
   `proof/competitive.md` is treated as `visibility: internal` with a
   migration warning.

4. **Data file lineage.** When `source_authority.status: mirror`, an
   optional `refresh:` sub-block declares cadence (`manual`,
   `on-deploy`, `weekly`, `monthly`, `on-source-change`),
   `last_synced` date, and optional `sync_method`. Validators warn
   when mirrors look stale relative to declared cadence.

All four are additive. v1.1 brands validate cleanly against v1.2 with
zero changes.

See [`CHANGELOG.md`](./CHANGELOG.md) for the full version history.

## Required vs. Recommended vs. Optional

The three levels are explicit on every layer in `brand.yaml`:

| Level | Meaning | Consumer behavior |
|---|---|---|
| `required: true` | The brand is not valid without it. | Refuse to ingest. |
| `recommended: true` | Tool will ingest, but downstream features that depend on this layer will be unavailable or produce lower-quality output. | Ingest with warnings. |
| (neither) | Optional. Purely additive. | Ingest silently. |

When a layer is `recommended`, the contract honestly reflects that we have limited evidence about whether a future brand could safely omit it. The contract will tighten in v2 once a second and third brand are ingested.

## Validating a brand repo

A validator walks the repo and checks against `brand.yaml`:

1. Required files exist at the documented paths.
2. Required directories exist; required `min_files` thresholds are met for pattern-based contents (e.g., at least one `for-{audience}.md`).
3. Every `---`-delimited frontmatter block parses as YAML.
4. Required frontmatter fields are present on each file type.
5. Cross-file rules under `validation:` hold (e.g., a `validated: true` prompt must list real example paths; ui-tokens layers stack in order).

A reference validator implementation is planned. Until then, the schema is human-readable enough to spot-check by eye.

## Scaffolding a new brand

A starter skeleton lives in [`templates/empty-brand/`](./templates/empty-brand/). Copy it as the seed for a new brand repo. Steps:

1. Copy `templates/empty-brand/` to your new repo root.
2. Fill the required frontmatter fields in `identity.md`, `voice.md`, `vocabulary.md`, `design-tokens.md`, and at least one `messaging/for-{audience}.md`.
3. Add `recommended` layers as the brand matures: persona matrix, channel guides, proof library, data registry, prompts, examples.
4. Once the brand is stable enough to summarize, write `agent-context.md`.
5. Run validation. Iterate until clean.

## Mapping content into the abstract slots

The contract describes universal patterns. Each brand fills those patterns with its own values. A worked hypothetical: a B2B SaaS company called Acme that sells a single product to three customer segments would map content like this:

| Pattern in spec | Acme's instance |
|---|---|
| `messaging/for-{audience}.md` | `for-enterprise.md`, `for-mid-market.md`, `for-smb.md` |
| `personas/{audience}-{role}.md` | `enterprise-champion.md`, `enterprise-buyer.md`, `mid-market-champion.md`, … |
| `messaging/channel-{channel}.md` | `channel-deck.md`, `channel-email.md`, `channel-landing-page.md` |
| `product/{product-slug}.md` | `product/acme-platform.md` |
| `data/{topic}.yaml` | `data/team.yaml`, `data/market.yaml`, `data/stats.yaml` |
| `prompts/{content-type}.md` | `one-pager.md`, `email-sequence.md`, `deck-sales.md` |

The audience taxonomy (enterprise / mid-market / smb), the role taxonomy (champion / buyer / end-user), and the channel list are all **brand-defined**. Another brand could just as easily use `commercial / public-sector / non-profit` audiences, or audiences keyed on industry vertical, or no segmentation at all. The pattern is in the spec; the values are in the brand.

## Reading the contract

`brand.yaml` is organized as:

- `conventions:` — cross-cutting rules (file naming, frontmatter syntax, reserved prefixes, common fields seen across multiple file types).
- `layers:` — one entry per layer (agent_context, identity, voice, vocabulary, design, ui_tokens, messaging, personas, proof, data, product, examples, prompts, design_specs, meta). Each layer declares its required level, the files or directories it owns, and the frontmatter contract for each file type.
- `validation:` — cross-layer rules a validator should enforce.

## Known gaps for v2

These are real gaps observed during the v1 reverse-engineering. They are intentionally **not** fields in the v1 schema — they will be added when a second and third brand have been ingested or a clear product need emerges.

1. **No top-level brand manifest.** There's no single file declaring "this repo conforms to brand-spec v1." Today the conformance is implicit. v2 SHOULD add a top-level manifest (e.g., `.brand-spec.yaml`) that pins the schema version and lists which optional layers the brand opts into.
2. **Ambiguous required vs. recommended for personas, proof, data, product, prompts, examples.** All are marked `recommended` because we only have one production instance and cannot yet tell which would degrade consumers to a degree that warrants `required`. v2 should harden these once more brands exist.
3. **No taxonomy declaration.** The brand's `audience`, `role`, and `channel` taxonomies are implicit (they emerge from the filenames and frontmatter values present). v2 SHOULD add an explicit taxonomy declaration so validators can catch typos and misclassifications.
4. **`data/` schemas are file-internal.** Each YAML file in `data/` documents its own schema in a comment header. That's fine for human readers but invisible to a validator. v2 should either link each `data/*.yaml` to a JSON Schema or formalize a tiny meta-schema for data files.
5. **`design-tokens.md` is prose.** Colors, type, and email tokens are documented in markdown tables. A machine-readable token export (e.g., `design-tokens.json` in the W3C Design Tokens format) would let downstream tools consume them directly. The `ui-tokens/` files point in this direction but are also still prose.
6. **No multi-product story.** `product/` works as a directory pattern, but cross-product relationships (suite hierarchy, dependencies, shared messaging) have no schema slot.
7. **Persona `_archive/` convention is by example, not by rule.** The underscore-prefix-means-not-content convention is documented in `conventions.reserved_prefixes` but isn't enforced beyond a comment.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Schema changes require a version bump per the policy in [`VERSIONING.md`](./VERSIONING.md) — default to patch bumps; minor and major bumps require justification. Discuss larger changes in an issue first.

## Versioning

[`VERSIONING.md`](./VERSIONING.md) documents what counts as patch / minor / major for this schema. The short version: additive changes are patches, new capability domains are minor bumps, breaking changes are major bumps. Default to patch.

## License

MIT. See [`LICENSE`](./LICENSE).

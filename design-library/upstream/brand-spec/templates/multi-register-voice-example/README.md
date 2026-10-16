# Multi-register voice example

Demonstrates the v1.2 multi-register voice pattern with v1.3 conventions
applied. Use this when a brand has more than one distinct on-brand voice
that varies by channel or context (e.g., corporate marketing voice vs.
engineering/agent voice vs. founder byline voice — all on-brand,
contextually distinct).

## Layout

```
voice/
  README.md              # lists registers, documents when each applies;
                         # (v1.3) MAY include a `precedence:` frontmatter block
  registers/
    corporate.md         # primary register — marketing, website, customer comms
    engineering.md       # secondary register — code, agent prompts, technical docs
```

## Rules

- A brand uses EITHER single-register (`voice.md` at root, the v1.1
  default) OR multi-register (`voice/` directory). Never both — see the
  `voice-pattern-exclusive` validation rule in `brand.yaml`.
- `voice/README.md` (or `voice/_index.md`) is required when the
  multi-register pattern is used. It lists the registers and documents
  precedence rules for ambiguous contexts.
- Each register file requires `register:` and `applies_to_refs:`
  frontmatter (the v1.7.0 cross-layer reference convention form;
  `applies_to:` is the legacy form and continues to validate).
  All other voice frontmatter (`perspective`, `default_tone`,
  `reading_level`) follows the v1.1 single-register contract.

## v1.3 conventions demonstrated in this template

- **Corpus metadata (issue #8 item 1)** — both register files declare
  `corpus_size`, `corpus_source`, `corpus_pulled`, and `confidence`
  in frontmatter (with `TODO` placeholders since this is a sample).
- **Body section guidance for register 2+ (issue #8 item 5)** —
  `engineering.md` uses "What this register allows that `corporate`
  does not" and "What is still forbidden (inherited)" instead of
  "What the Voice Is NOT." `corporate.md` (the primary register) keeps
  the canonical "What the Voice Is NOT" section.
- **Cross-register precedence (issue #8 item 7)** — `voice/README.md`
  declares a `precedence:` frontmatter block with `default_order` and
  `surface_overrides`, mirrored by the prose "Precedence when contexts
  overlap" section.
- **Platform overlays (issue #8 item 8)** — `engineering.md` shows
  both forms: a `platform_overlays:` frontmatter block (`github` and
  `cli` keys) and an equivalent `On GitHub` H2 section. Brands MAY
  use either; both are acceptable.
- **"What does NOT fit this register" (issue #8 item 9)** — both
  register files include this section for drift-detection.
- **Quoted-voice callout (issue #8 item 4)** — `engineering.md` shows
  the inline `> Quoted: <attribution>` markdown callout convention.

## Inheritance is enforced

(v1.3, issue #8 items 3 and 6.) The
`register-inheritance-cannot-subtract` validator rule enforces that
no register file may explicitly allow a term that `vocabulary.md`
forbids brand-wide. Forbidden terms inside `> Quoted:` callouts,
"Published Voice Examples" quote blocks, and "What does NOT fit"
sections are ignored (illustrative, not register-permissive).

Most brands won't need this. Start with `templates/empty-brand/voice.md`;
graduate to multi-register only when the single file is being pulled in
contradictory directions.

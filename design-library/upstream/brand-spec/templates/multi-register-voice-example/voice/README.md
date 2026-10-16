---
# (v1.3) Optional precedence frontmatter — issue #8 item 7.
# Validator-friendly equivalent of the prose "Precedence when contexts
# overlap" section below. When both are present they MUST agree.
precedence:
  default_order:
    - corporate
    - engineering
  surface_overrides:
    # When a surface matches both registers, the surface_overrides map
    # wins over default_order. Example: a public-facing README on a
    # marketing repo is `corporate`; a public-facing README on an
    # engineering repo is `engineering`.
    public-marketing-readme: corporate
    public-engineering-readme: engineering
---

# Voice — register index

This brand uses two registers. They are both on-brand. Use the right one
for the context.

## Registers

### `corporate`

**Applies to:** website, blog, marketing emails, sales decks, customer
onboarding, public social posts.

The voice the public hears. Polished, confident, approachable.

See [`registers/corporate.md`](./registers/corporate.md).

### `engineering`

**Applies to:** code comments, agent system prompts, technical docs,
internal engineering Slack, GitHub issues and PR descriptions, error
messages.

The voice the team uses with itself and with technical users. Direct,
specific, low ceremony.

See [`registers/engineering.md`](./registers/engineering.md).

## Precedence when contexts overlap

Mirrors the `precedence:` frontmatter block above in human-facing form.

- A blog post about an engineering topic uses `corporate` voice with
  `engineering`-style code blocks. The surrounding prose is `corporate`.
- A README on a public open-source repo uses `engineering` voice — the
  audience is engineers, not buyers.
- A customer-facing error message uses `corporate` voice with the
  brevity and specificity of `engineering`.

When in doubt, ask: who is the audience? Buyers and prospects →
`corporate`. Engineers and operators → `engineering`.

## What both registers share (brand-wide constraints)

(v1.3, issue #8 items 3 and 6.) Both registers inherit from
`vocabulary.md`. The forbidden-terms list applies everywhere — neither
register gets to use a brand-wide forbidden term. Register files **add**
permissions; they do **not** subtract brand-wide constraints. The
validator enforces this via the `register-inheritance-cannot-subtract`
rule.

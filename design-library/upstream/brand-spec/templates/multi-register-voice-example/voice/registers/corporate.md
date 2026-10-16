---
register: corporate
applies_to_refs: [website, blog, marketing-emails, sales-decks, onboarding, linkedin-company-page]
default_tone: confident-direct
reading_level: professional
perspective: second-person
status: sample
# (v1.3) Corpus metadata — issue #8 item 1. Optional but SHOULD be
# present when the register was authored from a corpus. Replace with
# real values when you derive your corporate voice from real samples.
corpus_size: 0
corpus_source: "TODO — e.g., 'website pages: index, pricing, about, proof'"
corpus_pulled: "TODO-YYYY-MM-DD"
confidence: low
---

# Voice — corporate register (primary)

> **Sample file.** Replace with your brand's actual corporate voice.
> Delete this callout when you do.

## Core Characterization

The voice the public hears. Confident, direct, and respectful of the
reader's time. Speaks to "you" — the prospect, customer, or reader.

## Voice Attributes

- Confident without bravado
- Specific over abstract
- Short sentences. Concrete nouns.
- Honest about tradeoffs

## What the Voice Is NOT

(Primary-register canonical section. Secondary registers replace this
with two inheritance-aware sections — see `engineering.md`.)

- Not breezy or chatty
- Not corporate-bland ("synergy," "leverage," "robust")
- Not jargon-heavy

## Tone Rules

- Lead with the reader's outcome, not the product's feature.
- One idea per paragraph.
- Numbers beat adjectives.

## What does NOT fit this register

(v1.3, issue #8 item 9.) Drift-detection negative-space documentation.
Examples of content that looks corporate but is not:

- Imperative-to-the-reader code instructions ("Run X.") — that is
  `engineering`, not `corporate`.
- Internal Slack-tone shorthand or emoji-as-bullet — that is internal
  voice, not customer-facing.
- Product-marketing hype ("revolutionary," "best-in-class") — forbidden
  brand-wide; never on-register here.

If a generation request asks for one of these shapes, switch register
or push back on the brief.

## Published Voice Examples

TODO — link to canonical examples once they exist.

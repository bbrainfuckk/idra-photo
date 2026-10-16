---
register: engineering
applies_to_refs: [code-comments, agent-prompts, technical-docs, github-issues, error-messages, readmes]
default_tone: direct-specific
reading_level: technical
perspective: third-person
status: sample
# (v1.3) Corpus metadata — issue #8 item 1.
corpus_size: 0
corpus_source: "TODO — e.g., 'top 10 README files in the org's public repos'"
corpus_pulled: "TODO-YYYY-MM-DD"
confidence: low
# (v1.3) Platform overlays — issue #8 item 8. When the engineering
# register applies to multiple platforms with distinct conventions,
# document per-platform knobs here. (Equivalent H2 sections like
# `On GitHub` are also acceptable — see body below.) Replace with real
# overlays when you adopt them.
platform_overlays:
  github:
    hashtag_convention: none
    emoji_budget: "no decorative emoji; ✅/❌/⚠️ allowed in checklists"
    divider_convention: "horizontal rules between major sections"
    cta_permission: "allowed: 'open an issue,' 'send a PR'"
  cli:
    hashtag_convention: none
    emoji_budget: "none — restricted-encoding environments common"
    divider_convention: "ASCII-only; 80-column wrap"
    cta_permission: "allowed: 'run --help'"
---

# Voice — engineering register (secondary)

> **Sample file.** Replace with your brand's actual engineering voice.
> Delete this callout when you do.

## Core Characterization

The voice the team uses with itself and with technical users. Direct,
specific, low ceremony. No marketing softening. No hedging that hides
the actual behavior.

## Voice Attributes

- Imperative when giving instructions ("Run X.", not "You can run X.")
- Specific identifiers and exact strings, not paraphrases
- States the failure mode before the fix
- Comments explain WHY, not WHAT

## What this register allows that `corporate` does not

(v1.3, issue #8 item 5. Secondary-register canonical section.)

- **Imperative voice** ("Run X.", "Set Y to Z."). `corporate` describes;
  `engineering` instructs.
- **Exact identifiers and strings** verbatim — function names, env-var
  names, exit codes, error-string literals. `corporate` paraphrases for
  reading flow; `engineering` quotes.
- **Stack traces and code blocks** as primary content, not illustration.
- **Terms of art** without glossing — `mutex`, `idempotent`,
  `eventually-consistent`. `corporate` would expand or replace these.
- **Failure-mode-first framing** — name the bug before the fix.

## What is still forbidden (inherited)

(v1.3, issue #8 items 3, 5, 6.) The engineering register inherits every
brand-wide constraint from `vocabulary.md`. The
`register-inheritance-cannot-subtract` validator rule enforces this.
Specifically:

- **All brand-wide forbidden terms** still apply — `engineering` does
  not get to call something "revolutionary" because the register is
  internal-leaning.
- **Marketing flavoring** — "powerful," "seamless," "enterprise-grade"
  — forbidden in this register *and* brand-wide.
- **Apologetic phrasing** ("we're sorry but…") and vague error text
  ("something went wrong") — forbidden everywhere.

## On GitHub

(v1.3, issue #8 item 8 — H2-equivalent of the `platform_overlays.github`
frontmatter above. Either form is acceptable; this section exists in
the template to demonstrate the H2 convention for brands that prefer
prose to structured frontmatter.)

- Issue titles state the failure mode in present tense.
- PR descriptions lead with the change, then the reason, then the
  testing notes.
- Checkmark / X emoji are allowed only inside acceptance-criteria
  checklists.

## Tone Rules

- Error messages name the offending value and the expected shape.
- Code comments justify decisions; they don't narrate the code.
- Agent prompts state hard constraints as imperatives, not suggestions.

## What does NOT fit this register

(v1.3, issue #8 item 9.) Drift-detection negative-space documentation.
Examples of content that looks engineering-flavored but is not:

- Marketing copy that name-drops protocols (`HTTP/3`, `WASM`) for
  authority without engineering substance — that is `corporate` voice
  doing technical color, not `engineering`.
- "Engineering blog" thought-leadership posts authored for prospects —
  those are `corporate` long-form, not `engineering`.
- Inspirational quotes in code comments — comments justify decisions;
  decoration is off-register.

If a generation request asks for one of these shapes, switch register
(usually back to `corporate`).

## Published Voice Examples

TODO — link to canonical code, prompts, and error strings once they
exist. When quoting third-party voices (e.g., a Hacker News comment
that motivated a design decision), wrap the quote in a
`> Quoted: <attribution>` callout so validators skip voice/vocabulary
evaluation of the quoted text:

> Quoted: HN user @example, on the original RFC discussion
> "If you can't explain why it's idempotent in one sentence, it isn't."

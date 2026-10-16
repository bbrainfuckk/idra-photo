# {Brand Name}

<!-- TODO: 1-2 sentences describing this brand repo. Replace {Brand Name} above. -->

This repo conforms to [`gramatr/brand-spec`](https://github.com/gramatr/brand-spec) v1. Tools and AI agents can clone it and load the brand's identity, voice, vocabulary, design tokens, personas, examples, and prompts directly from the file tree.

## Structure

See [`brand-spec/brand.yaml`](https://github.com/gramatr/brand-spec/blob/main/brand.yaml) for the canonical schema. This repo provides:

- `identity.md`, `voice.md`, `vocabulary.md`, `design-tokens.md` (required)
- `assets/_manifest.md` (required)
- `messaging/for-{audience}.md` (at least one required)
- `agent-context.md` (recommended) — entry point for context-constrained agents
- Recommended layers: `personas/`, `messaging/channel-*.md`, `proof/`, `data/`, `product/`, `examples/`, `prompts/`

## Editing

Edit markdown directly. YAML frontmatter is machine-readable; body content is semantic context. Validate against `brand-spec` before publishing changes.

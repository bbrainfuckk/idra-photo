---
layer: semantic
depends-on:
  - primitives.md
version: "0.1"
status: sample
last_updated: "2026-01-01"
---

# UI Tokens — Semantic (SAMPLE)

> **This is a sample file.** Replace with your brand's real semantic
> token mapping. Semantic tokens give primitives *meaning*. Components
> reference semantic tokens, never primitives directly — that's how a
> dark-mode overlay works without rewriting components. Delete this
> callout when you replace the content.

## Surfaces

| Semantic token            | Maps to            |
| ------------------------- | ------------------ |
| `color.surface.page`      | `color.gray.50`    |
| `color.surface.card`      | `color.gray.100`   |
| `color.surface.inverse`   | `color.gray.900`   |

## Text

| Semantic token            | Maps to            |
| ------------------------- | ------------------ |
| `color.text.primary`      | `color.gray.900`   |
| `color.text.secondary`    | `color.gray.500`   |
| `color.text.inverse`      | `color.gray.50`    |
| `color.text.accent`       | `color.blue.700`   |

## Intent

| Semantic token            | Maps to            |
| ------------------------- | ------------------ |
| `color.intent.primary`    | `color.blue.500`   |
| `color.intent.danger`     | `color.red.500`    |
| `color.intent.success`    | `color.green.500`  |

## Spacing aliases

| Semantic token            | Maps to            |
| ------------------------- | ------------------ |
| `space.inline.tight`      | `space.2`          |
| `space.inline.default`    | `space.3`          |
| `space.stack.section`     | `space.8`          |

## Rules

- Components MUST consume semantic tokens, not primitives.
- A dark-mode overlay (`dark-mode.md`) re-maps these semantic tokens
  to different primitives. The semantic layer's *names* never change.

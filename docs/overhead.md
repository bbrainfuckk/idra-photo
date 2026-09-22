# Overhead

What is measured: the MCP tool traffic between the agent and Idra, in calls and JSON bytes, for the same 100-job simulated workload. Raw results are in [`overhead-results.json`](overhead-results.json). Re-run with:

```bash
npm run overhead
```

## Results (2026-09-22, Windows x64, Node 24.21.0)

| Design | Tool calls | Calls per image | Response bytes | Response bytes per image |
|---|---|---|---|---|
| Idra combined step | 102 | 1.02 | 119,480 | 1,195 |
| Synthetic chatty baseline | 202 | 2.02 | 1,925,420 | 19,254 |

- The **synthetic chatty baseline** is defined by `tests/bench/overhead.ts`. It is the same combined step plus a full job-list status call after every image, standing in for designs that re-send batch state each turn. It is not a measurement of any other product.
- Of the 1,195 bytes per image, about 562 are the job prompt itself: the base prompt, the per-job rules, and the reference note. This is fidelity-critical and is not trimmed.
- Server instructions are about 1.2 KB, sent once per session.

## What this does not tell you

- **Tokens are unknown.** No tokenizer or host usage data was available for these runs, and bytes are not tokens. The one real Codex check, a text-only status call, reported 12,909 tokens for the whole turn, most of it Codex's own context rather than Idra.
- It excludes host planning and reasoning, native image generation (the dominant cost), image inputs, retries, and any visual review.
- It says nothing about account-level savings or how many images a plan allows.

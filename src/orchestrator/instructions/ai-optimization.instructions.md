---
description: 'AI assistant optimization patterns for efficient context usage and tool calls'
applyTo: '**'
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# AI Optimization

Batch independent operations, gather context before acting, and avoid redundant tool calls.

## Key Rules

- **Batch independent reads** — parallelize file reads, searches, and error checks in a single call instead of sequentially
- **Don't batch dependent ops** — if step B needs step A's output, run them sequentially
- **Gather context first** — read and search before editing; don't act on assumptions
- **Read strategically** — prefer large ranges (500–2000 lines) over many micro-reads; use `grep_search` to locate, then read targeted ranges
- **Combine searches** — use regex alternation (`word1|word2|word3`) instead of separate searches
- **Don't re-read** — if a file or sub-agent result is already in context, use it directly
- **Verify once per phase** — run tests/lint/errors after a batch of edits, not after each individual change
- **Scale planning to complexity** — trivial (1–2 files) → act directly; large (10+ files) → full decomposition
- **Trust sub-agent results** — don't re-search or re-read what a sub-agent already returned
- **Include file paths in delegation prompts** — saves the sub-agent from wasting context on discovery

## Anti-Patterns

1. **Micro-reads** — reading tiny file sections repeatedly
2. **Sequential searches** — running independent searches one at a time
3. **Premature actions** — editing before gathering sufficient context
4. **Over-checking** — validating after every tiny change instead of batching
5. **Re-gathering delegated context** — re-reading files a sub-agent already analyzed
6. **Over-planning** — full decomposition for a 2-file fix

<!-- End of AI Optimization Instructions -->

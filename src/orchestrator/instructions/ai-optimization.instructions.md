---
description: 'AI assistant optimization techniques for efficient context usage and faster responses'
applyTo: '**'
---

# AI Assistant Optimization Instructions

## Batch Processing

### DO: Batch Independent Operations

When gathering context, batch all read operations together in a single parallel call:

```
Good: Read 3 files + search in parallel → 1 cache-friendly turn
Bad: Read file 1 → Read file 2 → Read file 3 → 3 separate turns
```

When modifying multiple independent files, batch the edits:

```
Good: Update 5 config files in parallel
Bad: Update config 1 → wait → Update config 2 → wait...
```

### DON'T: Batch Dependent Operations

Don't batch operations where one depends on the output of another:

```
Bad: Read file + Edit file (need to read first)
Good: Read file → Analyze → Edit file
```

## Context Gathering Workflow

Gather all necessary context upfront before analysis/implementation:

```
Phase 1 (parallel): Read files + search for patterns + check errors
Phase 2: Analyze and plan
Phase 3 (parallel if independent): Create/modify files
Phase 4: Verify (tests, errors, lint)
```

## Token Reduction Techniques

### Strategic Tool Selection

- Use `grep_search` with `includePattern` to scope searches to specific directories
- Use `file_search` to find files by pattern before reading
- Use `semantic_search` for exploring unfamiliar code instead of multiple grep searches
- Read targeted line ranges when you know approximately where code is

### Avoid Redundant Operations

- Don't re-read files already in context from the same conversation turn
- Check errors once per phase, not after every single change
- Don't search for what's already mentioned in context
- Use regex with alternation (e.g., `word1|word2|word3`) to combine searches

### Read Strategically

- Read larger sections (500-2000 lines) instead of many small reads
- Use `grep_search` to locate code, then read targeted ranges around it
- Deduplicate file paths before batching read operations

## Multi-Agent Optimization

### Sub-Agent Context Isolation

Sub-agents run in isolated context windows. Use this to your advantage:

- **Offload exploration** — fire a sub-agent to research a broad question; only the concise result comes back, keeping your primary context clean
- **Parallel research** — launch multiple sub-agents simultaneously for independent research tasks (e.g., "find all GROQ queries" + "list all components using X" at the same time)
- **Detailed prompts save tokens** — a specific sub-agent prompt avoids the sub-agent doing its own exploratory searches, which would waste its context budget

### Trust Sub-Agent Results

- Don't re-read files a sub-agent just analyzed — trust the returned summary
- Don't re-search for patterns a sub-agent already identified
- If a sub-agent returns file paths or code snippets, use them directly

### Background Agents for Long Work

- Delegate tasks expected to take >5 minutes to background agents — they run in parallel without blocking
- Include **all necessary context** in the delegation prompt (background agents can't ask follow-up questions)
- Batch independent background delegations together (e.g., launch DB migration + UI components + docs simultaneously)

### Delegation Prompt Efficiency

- Include exact file paths so the delegated agent doesn't waste time searching
- Reference existing patterns ("follow the structure in `libs/ui-kit/src/lib/Button/`") instead of describing patterns from scratch
- Set clear scope boundaries ("only modify files under `libs/queries/`") to prevent unnecessary exploration

## Response Optimization

- Provide brief progress updates after batched operations
- Describe changes concisely instead of repeating large code blocks
- Plan what context is needed before making tool calls
- Combine multiple related edits in planning before executing

## Planning Thresholds

Scale planning effort to task complexity — don't over-plan simple work:

| Complexity | Planning | Approach |
|-----------|----------|----------|
| Trivial (1-2 files, clear fix) | None | Act directly |
| Small (3-5 files, single concern) | Mental plan | Brief reasoning, then act |
| Medium (5-10 files, multiple concerns) | Todo list | Track steps, batch reads |
| Large (10+ files, cross-cutting) | Full decomposition | Dependency graph, phased execution |

**Stop-and-re-plan trigger:** See the Task Decomposition Protocol in `general.instructions.md` (step 5).

## Test & Build Output Efficiency

- Capture full test/build output **once** per verification phase, not after each micro-change
- Pipe verbose output through `tail -n 30` or `grep -E 'FAIL|ERROR|PASS'` to reduce noise
- When tests fail, read the **relevant failure block** — don't re-run the entire suite repeatedly

## README Cascade Reading

When entering an unfamiliar directory, check for a `README.md` before exploring files. READMEs provide architecture context that prevents wasted searches. Priority order:
1. Project root `README.md` (already covered by instruction files)
2. Library/app-level `README.md` (e.g., `libs/queries/README.md`)
3. Feature-level `README.md` (e.g., `libs/data-pipeline/src/lib/scrapers/README.md`)

## Anti-Patterns to Avoid

1. **Micro-reads** — Reading tiny file sections repeatedly
2. **Sequential searches** — Running searches one at a time when they're independent
3. **Premature actions** — Acting before gathering sufficient context
4. **Silent processing** — Batching without progress updates
5. **Exploratory tool calls** — Making tool calls without a clear plan
6. **Over-checking** — Validating after every tiny change instead of batching
7. **Re-gathering delegated context** — Re-reading files or re-searching after a sub-agent already returned the information
8. **Vague delegation prompts** — Forcing sub-agents to waste their context budget on discovery you already completed
9. **Sequential delegation** — Running independent sub-agents one-by-one when they could run in parallel
10. **Leaking secrets** — Printing tokens, keys, or passwords in terminal output or logs (violates Constitution #1)
11. **Over-planning** — Writing a full decomposition for a 2-file fix (see Planning Thresholds)

<!-- End of AI Optimization Instructions -->

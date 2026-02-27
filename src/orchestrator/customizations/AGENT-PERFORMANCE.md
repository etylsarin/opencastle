````markdown
# Agent Performance Tracking

> **Last Updated:** _(auto-updated by metrics-report prompt)_

Tracks agent success rates across panel reviews and delegated tasks to inform model routing and panel reviewer selection.

## Data Sources

Performance data is collected automatically via NDJSON session logs:
- **Session data:** `customizations/logs/sessions.ndjson` — appended by every agent after each session
- **Delegation data:** `customizations/logs/delegations.ndjson` — appended by the Team Lead after each delegation
- **Full reporting:** Run the **metrics-report** prompt to generate a dashboard from all sources

## Quick Queries

```bash
# Sessions per agent
jq -r '.agent' customizations/logs/sessions.ndjson | sort | uniq -c | sort -rn

# Success rate by agent
jq -r '[.agent, .outcome] | @tsv' customizations/logs/sessions.ndjson | sort | uniq -c

# Delegation tier distribution
jq -r '.tier' customizations/logs/delegations.ndjson | sort | uniq -c

# Failed delegations
jq 'select(.outcome == "failed")' customizations/logs/delegations.ndjson
```

## Panel Review Performance

Panel review data is collected automatically via `customizations/logs/panels.ndjson` (appended by the panel runner after each review — see step 7 in the panel majority vote skill).

```bash
# Total panel reviews
wc -l customizations/logs/panels.ndjson

# Pass vs block rate
jq -r '.verdict' customizations/logs/panels.ndjson | sort | uniq -c

# Reviews by panel key
jq -r '.panel_key' customizations/logs/panels.ndjson | sort | uniq -c | sort -rn

# Reviews that required retries (attempt > 1)
jq 'select(.attempt > 1)' customizations/logs/panels.ndjson

# Average SHOULD-FIX items per review
jq -s 'if length > 0 then (map(.should_fix) | add) / length else 0 end' customizations/logs/panels.ndjson
```

## Usage

Referenced by the **panel-majority-vote** skill for weight assignment:
- Agents with >80% success rate for similar reviews get a +1 weight bonus
- This file is the source of truth for that metric

````

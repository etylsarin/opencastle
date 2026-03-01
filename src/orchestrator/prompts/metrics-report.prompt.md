---
description: 'Collect and report metrics from agent logs, GitHub PRs, Linear issues, and Vercel deployments'
agent: Researcher
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Metrics Report

Generate a comprehensive metrics dashboard from all project data sources.

## Data Sources

Collect data from ALL of these sources. Run collections in parallel where possible.

### 1. Agent Session Logs (local)

Read `.github/customizations/logs/sessions.ndjson` and `.github/customizations/logs/delegations.ndjson`.

Compute:
- **Total sessions** and **sessions per agent**
- **Success rate** — `outcome` field breakdown (success / partial / failed)
- **Retries per session** — average and total
- **Lessons added** — count and which agents contribute most
- **Delegation stats** — mechanism (sub-agent vs background), tier distribution, success rate per agent
- **Model usage** — which models used how often
- **Activity timeline** — sessions per day/week

### 2. GitHub PRs and Commits

Use `gh` CLI commands (always prefix with `GH_PAGER=cat`):

```bash
# All PRs (open + closed + merged)
GH_PAGER=cat gh pr list --state all --limit 100 --json number,title,state,createdAt,mergedAt,closedAt,author,additions,deletions,changedFiles,labels,headRefName

# Recent commits on main
GH_PAGER=cat gh api repos/{owner}/{repo}/commits --paginate -q '.[0:50] | .[] | {sha: .sha[0:7], date: .commit.author.date, message: .commit.message}' 2>/dev/null || git --no-pager log main --oneline -50
```

Compute:
- **PR count** — total, open, merged, closed-without-merge 
- **Merge rate** — merged / (merged + closed-without-merge)
- **Time to merge** — median and average (createdAt → mergedAt)
- **PR size** — average additions, deletions, changedFiles
- **Commit frequency** — commits per day/week on main
- **Bogus/closed PRs** — PRs closed without merge (potential failed agent work)

### 3. Linear Issues

Use Linear MCP tools (`list_issues`, `search_issues`):

```
list_issues with status filter for each state: Backlog, Todo, In Progress, Done, Cancelled
```

Compute:
- **Issue count by status** — Backlog, Todo, In Progress, Done, Cancelled
- **Completion rate** — Done / (Done + Cancelled + In Progress + Todo)
- **Issues by label** — which areas have the most work
- **Issues by priority** — distribution across Urgent/High/Medium/Low
- **Cycle time** — average time from In Progress → Done (if dates available)
- **Stale issues** — In Progress for >7 days without updates

### 4. Vercel Deployments

Use Vercel MCP tools (`list_deployments`, `get_deployment`):

Query deployments for all configured apps (see `project.instructions.md` for the app inventory).

Compute:
- **Total deployments** — count over last 30 days
- **Deployment success rate** — ready / (ready + error + cancelled)
- **Failure rate** — error / total
- **Build times** — average, median, p95
- **Deployments per day** — activity timeline
- **Failed deployment details** — which commits/branches failed and why (use `get_deployment_build_logs` for recent failures)

### 5. Panel Reviews (local)

Read `.github/customizations/logs/panels.ndjson`.

Compute:
- **Total reviews** — count of panel runs
- **Pass rate** — pass / total
- **Must-fix vs should-fix** — average counts per review
- **Retry rate** — reviews with attempt > 1
- **Model usage** — which reviewer models used
- **Reviews by panel key** — what gets reviewed most

### 6. Agent Failures (DLQ)

Read `.github/customizations/AGENT-FAILURES.md`.

Compute:
- **Total failures** — count of DLQ entries
- **Failures by agent** — which agents fail most
- **Failure status** — pending vs resolved
- **Common root causes** — categorize failure reasons

## Report Format

Present the report as a structured markdown summary with these sections:

```markdown
# Project Metrics Dashboard
> Generated: {date}  |  Period: Last 30 days

## Executive Summary
- X agent sessions, Y% success rate
- Z PRs merged, W% merge rate  
- N deployments, M% success rate
- P Linear issues completed

## Agent Activity
{sessions table, success rates, model usage}

## Delegation Performance  
{per-agent delegation stats, tier distribution}

## GitHub
{PR stats, merge rates, commit frequency}

## Linear Board
{issue distribution, completion rate, stale issues}

## Vercel Deployments
{success rate, failure rate, build times}

## Panel Reviews
{pass rate, retry rate, must-fix/should-fix stats}

## Agent Failures (DLQ)
{failure count, pending items}

## Trends & Recommendations
{observations, areas for improvement}
```

## Usage

Run this prompt periodically (weekly recommended) to track project health. Compare with previous reports to identify trends.

If session logs are empty (no data yet), still collect GitHub/Linear/Vercel data and note that agent logging has just been enabled.

# Agent Session Logs

Append-only NDJSON logs for agent activity tracking. Each file stores one JSON object per line.

## Files

| File | Appended by | Schema |
|------|------------|--------|
| `sessions.ndjson` | All agents (via self-improvement protocol) | Session record |
| `delegations.ndjson` | Team Lead agent | Delegation record |
| `reviews.ndjson` | Team Lead (via fast-review skill) | Fast review record |
| `panels.ndjson` | Panel runner (via panel majority vote skill) | Panel record |
| `disputes.ndjson` | Team Lead (via dispute protocol) | Dispute record |

## Session Record Schema

```json
{
  "timestamp": "2026-02-25T14:30:00Z",
  "agent": "Developer",
  "model": "gpt-5.3-codex",
  "task": "PRJ-57: Fix header component",
  "linear_issue": "PRJ-57",
  "outcome": "success",
  "duration_min": 12,
  "files_changed": 5,
  "retries": 0,
  "lessons_added": [],
  "discoveries": []
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | `string` | Yes | ISO 8601 datetime (YYYY-MM-DDTHH:MM:SSZ) |
| `agent` | `string` | Yes | Agent name from the registry |
| `model` | `string` | Yes | Model used (e.g., `claude-opus-4-6`, `gpt-5.3-codex`) |
| `task` | `string` | Yes | Short description of the task performed |
| `linear_issue` | `string` | No | Issue ID if applicable (e.g., `PRJ-57`) |
| `outcome` | `string` | Yes | `success`, `partial`, `failed` |
| `duration_min` | `number` | No | Estimated session duration in minutes |
| `files_changed` | `number` | No | Number of files created/modified |
| `retries` | `number` | No | Number of retried operations |
| `lessons_added` | `string[]` | No | Lesson IDs added (e.g., `["LES-015"]`) |
| `discoveries` | `string[]` | No | Issues discovered (issue IDs or KNOWN-ISSUES IDs) |

## Delegation Record Schema

```json
{
  "timestamp": "2026-02-25T14:30:00Z",
  "session_id": "feat/prj-57",
  "agent": "Developer",
  "model": "gpt-5.3-codex",
  "tier": "fast",
  "mechanism": "sub-agent",
  "linear_issue": "PRJ-57",
  "outcome": "success",
  "retries": 0,
  "phase": 2,
  "file_partition": ["src/components/", "src/pages/"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | `string` | Yes | ISO 8601 datetime (YYYY-MM-DDTHH:MM:SSZ) |
| `session_id` | `string` | Yes | Branch name or feature identifier |
| `agent` | `string` | Yes | Agent name delegated to |
| `model` | `string` | Yes | Model used |
| `tier` | `string` | Yes | `economy`, `fast`, `standard`, `premium` |
| `mechanism` | `string` | Yes | `sub-agent` or `background` |
| `linear_issue` | `string` | No | Issue ID |
| `outcome` | `string` | Yes | `success`, `partial`, `failed`, `redirected` |
| `retries` | `number` | No | Times re-delegated |
| `phase` | `number` | No | Execution phase number |
| `file_partition` | `string[]` | No | Directories/files assigned |

## Fast Review Record Schema

```json
{
  "timestamp": "2026-02-28T14:30:00Z",
  "linear_issue": "PRJ-42",
  "agent": "Developer",
  "reviewer_model": "gpt-5-mini",
  "verdict": "pass",
  "attempt": 1,
  "issues_critical": 0,
  "issues_major": 0,
  "issues_minor": 2,
  "confidence": "high",
  "escalated": false,
  "duration_sec": 45
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | `string` | Yes | ISO 8601 datetime (YYYY-MM-DDTHH:MM:SSZ) |
| `linear_issue` | `string` | No | Issue ID if applicable |
| `agent` | `string` | Yes | Agent whose output was reviewed |
| `reviewer_model` | `string` | Yes | Model used for the reviewer (e.g., `gpt-5-mini`) |
| `verdict` | `string` | Yes | `pass` or `fail` |
| `attempt` | `number` | Yes | Review attempt number (1, 2, or 3) |
| `issues_critical` | `number` | Yes | Count of critical severity issues |
| `issues_major` | `number` | Yes | Count of major severity issues |
| `issues_minor` | `number` | Yes | Count of minor severity issues |
| `confidence` | `string` | Yes | Reviewer self-reported confidence: `low`, `medium`, `high` |
| `escalated` | `boolean` | Yes | Whether this review triggered escalation to panel |
| `duration_sec` | `number` | No | Review duration in seconds |

## Panel Record Schema

```json
{
  "timestamp": "2026-02-25T14:30:00Z",
  "panel_key": "instruction-refactoring",
  "verdict": "pass",
  "pass_count": 3,
  "block_count": 0,
  "must_fix": 0,
  "should_fix": 5,
  "reviewer_model": "claude-opus-4-6",
  "weighted": false,
  "attempt": 1,
  "linear_issue": "PRJ-57",
  "artifacts_count": 14,
  "report_path": "customizations/logs/panel/instruction-refactoring.md"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | `string` | Yes | ISO 8601 datetime (YYYY-MM-DDTHH:MM:SSZ) |
| `panel_key` | `string` | Yes | Filesystem-safe panel identifier |
| `verdict` | `string` | Yes | `pass` or `block` |
| `pass_count` | `number` | Yes | Number of reviewers who voted PASS |
| `block_count` | `number` | Yes | Number of reviewers who voted BLOCK |
| `must_fix` | `number` | Yes | Total MUST-FIX items across all reviewers |
| `should_fix` | `number` | Yes | Total SHOULD-FIX items across all reviewers |
| `reviewer_model` | `string` | Yes | Model used for reviewers |
| `weighted` | `boolean` | Yes | Whether performance-weighted voting was applied |
| `attempt` | `number` | Yes | Attempt number (1 = first try) |
| `linear_issue` | `string` | No | Issue ID if applicable |
| `artifacts_count` | `number` | No | Number of artifacts reviewed |
| `report_path` | `string` | No | Path to the full panel report |

## Dispute Record Schema

```json
{
  "timestamp": "2026-02-28T16:00:00Z",
  "dispute_id": "DSP-001",
  "linear_issue": "PRJ-42",
  "priority": "high",
  "trigger": "panel-3x-block",
  "implementing_agent": "Developer",
  "reviewing_agents": ["Reviewer", "Panel (3x)"],
  "total_attempts": 6,
  "est_tokens_spent": 120000,
  "status": "pending",
  "resolution_option_chosen": null,
  "resolved_at": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | `string` | Yes | ISO 8601 datetime when dispute was created |
| `dispute_id` | `string` | Yes | Dispute ID (e.g., `DSP-001`) |
| `linear_issue` | `string` | No | Issue ID if applicable |
| `priority` | `string` | Yes | `critical`, `high`, `medium`, `low` |
| `trigger` | `string` | Yes | `panel-3x-block`, `approach-conflict`, `criteria-conflict`, `architectural-ambiguity`, `external-dependency` |
| `implementing_agent` | `string` | Yes | Agent that attempted the implementation |
| `reviewing_agents` | `string[]` | Yes | Agents that reviewed (e.g., `["Reviewer", "Panel (3x)"]`) |
| `total_attempts` | `number` | Yes | Sum of fast review + panel attempts |
| `est_tokens_spent` | `number` | No | Estimated tokens spent across all attempts |
| `status` | `string` | Yes | `pending`, `resolved`, `deferred` |
| `resolution_option_chosen` | `string` | No | Which option the human chose (null if pending) |
| `resolved_at` | `string` | No | ISO 8601 datetime when resolved (null if pending) |

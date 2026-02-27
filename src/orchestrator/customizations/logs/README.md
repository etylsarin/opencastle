# Agent Session Logs

Append-only NDJSON logs for agent activity tracking. Each file stores one JSON object per line.

## Files

| File | Appended by | Schema |
|------|------------|--------|
| `sessions.ndjson` | All agents (via self-improvement protocol) | Session record |
| `delegations.ndjson` | Team Lead agent | Delegation record |
| `panels.ndjson` | Panel runner (via panel majority vote skill) | Panel record |

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

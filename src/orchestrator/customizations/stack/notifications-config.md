# Notifications Configuration

<!-- Populated by the `bootstrap-customizations` prompt based on `.opencastle.json` → `stack.notifications`. -->

Project-specific messaging configuration referenced by the `slack-notifications` skill (or Teams equivalent).

## Provider

<!-- Which messaging provider is configured: slack, teams, or none -->

| Field | Value |
|-------|-------|
| **Provider** | <!-- slack / teams / none --> |
| **MCP Server** | <!-- e.g., @kazuph/mcp-slack --> |
| **Bot Name** | <!-- e.g., OpenCastle Agents --> |

## Channels

Map project channels to their purpose. Agents use this table to determine where to post.

| Channel Name | Channel ID | Purpose |
|-------------|------------|---------|
| <!-- e.g., #agent-updates --> | <!-- e.g., C0AHAQFJ7C1 --> | <!-- General agent activity feed --> |
| <!-- e.g., #agent-approvals --> | <!-- e.g., C0BHKL3M2D4 --> | <!-- Approval requests requiring human action --> |
| <!-- e.g., #agent-errors --> | <!-- e.g., C0CJNM4P5E6 --> | <!-- Error reports and blocked tasks --> |

> **Tip:** Use `channels_list` via MCP to discover channel IDs, then populate this table.

## Notification Preferences

Configure which events trigger notifications and where they go.

| Event | Channel | Enabled |
|-------|---------|---------|
| Task started | <!-- #agent-updates --> | <!-- yes/no --> |
| Task completed | <!-- #agent-updates --> | <!-- yes/no --> |
| Approval needed | <!-- #agent-approvals --> | <!-- yes/no --> |
| Error / blocked | <!-- #agent-errors --> | <!-- yes/no --> |
| Session started | <!-- #agent-updates --> | <!-- yes/no --> |
| Session ended | <!-- #agent-updates --> | <!-- yes/no --> |

## Users

Map team members to their messaging user IDs for mentions.

| Name | User ID | Role |
|------|---------|------|
| <!-- e.g., Filip --> | <!-- e.g., U0AJ7DL9KS5 --> | <!-- e.g., Project Lead --> |

> **Tip:** Use `users_resolve` via MCP to look up user IDs by name or email.

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `SLACK_MCP_XOXB_TOKEN` | Bot token for Slack MCP server | Yes (if provider is Slack) |
| `SLACK_MCP_ADD_MESSAGE_TOOL` | Enable message posting (`true` or comma-separated channel IDs) | Yes (if agents should post) |

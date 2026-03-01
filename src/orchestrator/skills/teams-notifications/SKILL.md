---
name: teams-notifications
description: "Microsoft Teams MCP integration for agent-to-human notifications and bi-directional communication. Use when agents need to post progress updates, request approvals, or read user responses via Teams channels and chats."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Teams Notifications

Agent communication patterns via the Microsoft Teams MCP server (Microsoft Agent 365). Enables agents to post progress updates, request human approvals, and read responses — all through Teams channels and chats.

## MCP Server

| Field | Value |
|-------|-------|
| **URL** | `https://mcp.microsoft365.com/mcp` |
| **Type** | Remote MCP server (HTTP) |
| **Auth** | Microsoft Graph API — OAuth 2.0 with `McpServers.Teams.All` scope |
| **Platform** | Microsoft Agent 365 (Frontier preview) |
| **Status** | Preview — requires Microsoft Agent 365 Frontier preview access |

### Prerequisites

1. **Microsoft Agent 365 Frontier preview** enrollment
2. **App registration** in Microsoft Entra ID (Azure AD)
3. **Graph API permissions:** `McpServers.Teams.All` (delegated or application)
4. **Admin consent** for the registered app

> **Note:** The Teams MCP server is in preview and not yet generally available as a standalone endpoint. Features and availability may change.

## Available MCP Tools

The Teams MCP server exposes tools for:

- **Chats** — Create, list, read, update, delete chats
- **Messages** — Send, read, edit, delete messages in chats and channels
- **Channels** — List, create, manage channel settings
- **Members** — List, add, remove members from chats and channels
- **Teams** — List teams, get team details, manage team settings

Tool names follow the pattern `teams_<resource>_<action>`. Use tool discovery to list available tools at runtime.

## Agent Notification Patterns

### Progress Updates

Post structured progress updates to a designated channel:

```
Channel: Agent Updates (or project-specific channel)
Format:
  🔄 **Task:** TAS-42 — Add price filter component
  **Status:** In progress — implementing unit tests
  **Files changed:** 3 (PriceFilter.tsx, PriceFilter.test.tsx, index.ts)
  **ETA:** ~5 minutes
```

### Completion Notifications

```
✅ **Task:** TAS-42 — Add price filter component
**Status:** Complete — PR opened
**PR:** https://github.com/org/repo/pull/123
**Summary:** Added PriceRangeFilter with 4 range options, 12 unit tests passing
```

### Error / Blocking Notifications

```
🚨 **Task:** TAS-42 — Add price filter component
**Status:** Blocked — needs human input
**Issue:** Cannot determine correct price ranges for the market
**Action needed:** Reply in this thread with the desired price range values
```

## Bi-Directional Communication

### Human-in-the-Loop Approval

When an agent needs approval before proceeding:

1. **Post approval request** to the channel with clear instructions:
   ```
   ⏳ **Approval Required**
   Task: TAS-42 — Database migration adds `price_range` column
   Action: Run migration on production database
   
   Reply with:
   ✅ Approve — to proceed
   ❌ Reject — to stop
   Or reply with questions/comments
   ```

2. **Poll for response** — Read replies to determine the decision
3. **Acknowledge** — Post confirmation of the action taken

### Reading User Responses

To check for approvals or instructions:

1. Read message replies in the channel or chat thread
2. Parse reply content for approval keywords (`approve`, `approved`, `yes`, `proceed`, `reject`, `no`, `stop`)
3. Check for reactions on messages (Teams supports reactions via Graph API)

### Parsing Conventions

| Signal | Meaning |
|--------|---------|
| `✅` or "approve"/"yes" reply | Approved — proceed |
| `❌` or "reject"/"no" reply | Rejected — stop and report |
| `👀` reaction or "looking" reply | Acknowledged — user is reviewing |
| Detailed reply | Instructions or questions for the agent |
| `@mention` of agent | Direct command or question |

## Channel & Chat Conventions

### Channel Structure

| Channel | Purpose |
|---------|---------|
| Agent Updates | General agent activity feed |
| Agent Approvals | Approval requests requiring human action |
| Agent Errors | Error reports and blocked tasks |
| Project-specific channel | All activity for a specific project |

### Threading Rules

- **Always reply in threads** — use message replies, not top-level posts for follow-ups
- **One thread per task** — keep all updates for a single task in one conversation thread
- **Include task ID** — every message references the Linear/Jira issue ID
- **Mark important messages** — use importance flags for approval requests

### Chat vs Channel

| Use Case | Preferred |
|----------|-----------|
| Team-wide updates | Channel |
| Approval requests | Channel (for visibility) |
| Direct questions | 1:1 or group chat |
| Sensitive discussions | 1:1 chat |

## Message Formatting

Teams messages support HTML and a subset of Markdown:

| Format | Syntax |
|--------|--------|
| Bold | `**bold**` or `<strong>bold</strong>` |
| Italic | `*italic*` or `<em>italic</em>` |
| Code | `` `inline code` `` |
| Code block | ` ```code block``` ` |
| Link | `[Display Text](https://example.com)` |
| User mention | `<at>User Name</at>` (requires user ID in adaptive card) |
| List | `- item` or `1. item` |
| Heading | `### Heading` |

### Adaptive Cards

For richer formatting, Teams supports Adaptive Cards (JSON-based card format):

```json
{
  "type": "AdaptiveCard",
  "body": [
    { "type": "TextBlock", "text": "Approval Required", "weight": "Bolder", "size": "Medium" },
    { "type": "TextBlock", "text": "Task: TAS-42 — Database migration", "wrap": true }
  ],
  "actions": [
    { "type": "Action.Submit", "title": "Approve", "data": { "action": "approve" } },
    { "type": "Action.Submit", "title": "Reject", "data": { "action": "reject" } }
  ],
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4"
}
```

Use Adaptive Cards for approval workflows when available — they provide structured input.

## Rate Limits

Microsoft Graph API rate limits for Teams:

| Resource | Limit |
|----------|-------|
| Messages (per app per tenant) | 50 per second |
| Channel messages | 50 per second |
| Chat creation | 50 per second |
| Individual API calls | 10,000 per 10 minutes |

**Best practices:**
- Batch updates into single messages rather than posting many small messages
- Use threads to consolidate related updates
- Cache team/channel/user IDs — don't look them up repeatedly
- Respect 429 (Too Many Requests) responses with retry-after headers

## Security Considerations

- **OAuth tokens** are managed by the MCP server — agents never see raw tokens
- **Scope minimization** — request only the Graph API permissions agents actually need
- **Tenant restrictions** — configure the app for single-tenant or specific tenant access
- **Conditional Access** — Microsoft Entra Conditional Access policies apply to API calls
- **Audit logging** — Microsoft 365 audit logs capture all Graph API activity
- **No secrets in messages** — never post tokens, passwords, or credentials in Teams messages (per Constitution #1)
- **Data residency** — Teams data is stored in the tenant's Microsoft 365 region

## Integration with Agent Workflows

### Session Start

At the beginning of a work session, post a brief status message:
```
🏁 **Session started**
Agent: Frontend Engineer
Task: TAS-42 — Add price filter component
Mode: Autonomous (will request approval for destructive actions)
```

### Session End

At the end of a work session, post a summary:
```
🏁 **Session complete**
Agent: Frontend Engineer
Task: TAS-42 — Add price filter component
Result: ✅ PR opened (#123)
Duration: 12 minutes
Files changed: 5
Tests: 12 passing, 0 failing
```

### Error Recovery

If an agent encounters an unrecoverable error, notify before stopping:
```
💥 **Session failed**
Agent: Frontend Engineer
Task: TAS-42 — Add price filter component
Error: TypeScript compilation failed — 3 type errors in PriceFilter.tsx
Action: Posted details in thread. Needs manual fix or re-delegation.
```

## Preview Limitations

Since the Teams MCP server is in Frontier preview:

- **Availability** may change without notice
- **Tool surface** may be incomplete compared to the full Graph API
- **Performance** may vary during preview
- **Breaking changes** are possible between preview versions

Check [Microsoft Agent 365 documentation](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/) for the latest status.

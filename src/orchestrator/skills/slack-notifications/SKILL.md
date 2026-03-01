---
name: slack-notifications
description: "Slack MCP integration for agent-to-human notifications and bi-directional communication. Use when agents need to post progress updates, request approvals, or read user responses via Slack channels and threads."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Slack Notifications

Agent communication patterns via the Slack MCP server. Enables agents to post progress updates, request human approvals, and read responses — all through Slack channels and threads.

## MCP Server

| Field | Value |
|-------|-------|
| **URL** | `https://mcp.slack.com/mcp` |
| **Type** | Streamable HTTP (JSON-RPC 2.0) |
| **Auth** | OAuth 2.0 via registered Slack app (`client_id` + `client_secret`) |
| **Supported clients** | Claude.ai, Claude Code, Cursor, Perplexity |

### Required OAuth Scopes

The Slack app must be granted scopes for the operations agents will perform:

| Scope | Purpose |
|-------|---------|
| `channels:read` | List and search public channels |
| `channels:history` | Read messages in public channels |
| `chat:write` | Post messages and replies |
| `users:read` | Look up user profiles for mentions |
| `reactions:read` | Read emoji reactions (approval signals) |
| `reactions:write` | Add emoji reactions (acknowledgments) |
| `search:read` | Search messages and files |

Admin approval is required. Work with the workspace admin to install the app.

## Available MCP Tools

The Slack MCP server exposes tools for:

- **Search** — `slack_search_messages`, `slack_search_channels`, `slack_search_users`
- **Read** — `slack_get_channel_history`, `slack_get_thread_replies`, `slack_get_channel_info`
- **Write** — `slack_post_message`, `slack_reply_to_thread`, `slack_add_reaction`
- **Canvases** — `slack_create_canvas`, `slack_update_canvas`

Tool names may vary by MCP server version. Use tool discovery to list available tools at runtime.

## Agent Notification Patterns

### Progress Updates

Post structured progress updates to a designated channel:

```
Channel: #agent-updates (or project-specific channel)
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

When an agent needs approval before proceeding (destructive operations, production deployments, large refactors):

1. **Post approval request** to the channel with clear options:
   ```
   ⏳ **Approval Required**
   Task: TAS-42 — Database migration adds `price_range` column
   Action: Run migration on production database
   
   React with:
   ✅ — Approve and proceed
   ❌ — Reject and stop
   💬 — Reply in thread with questions
   ```

2. **Poll for response** — Read reactions or thread replies to determine the decision
3. **Acknowledge** — Post confirmation of the action taken

### Reading User Responses

To check for approvals or instructions:

1. Use `slack_get_thread_replies` to read replies to the approval message
2. Use `slack_get_channel_history` with a time range to find recent directives
3. Parse reactions on messages for quick yes/no signals

### Parsing Conventions

| Signal | Meaning |
|--------|---------|
| ✅ reaction | Approved — proceed |
| ❌ reaction | Rejected — stop and report |
| 👀 reaction | Acknowledged — user is reviewing |
| Thread reply | Detailed instructions or questions |
| `@agent` mention | Direct command or question for the agent |

## Channel & Thread Conventions

### Channel Structure

| Channel | Purpose |
|---------|---------|
| `#agent-updates` | General agent activity feed |
| `#agent-approvals` | Approval requests requiring human action |
| `#agent-errors` | Error reports and blocked tasks |
| Project-specific channel | All activity for a specific project |

### Threading Rules

- **Always thread replies** — never post top-level messages for follow-ups
- **One thread per task** — keep all updates for a single task in one thread
- **Include task ID** — every message references the Linear/Jira issue ID
- **Pin important threads** — pin approval requests and blocking issues

## Message Formatting

Slack uses a markdown-like syntax with some differences:

| Format | Syntax |
|--------|--------|
| Bold | `*bold*` |
| Italic | `_italic_` |
| Strikethrough | `~strikethrough~` |
| Code | `` `inline code` `` |
| Code block | ` ```code block``` ` |
| Link | `<https://example.com|Display Text>` |
| User mention | `<@U12345>` |
| Channel mention | `<#C12345>` |
| Emoji | `:emoji_name:` |
| Blockquote | `> quoted text` |
| List | `• item` or `1. item` |

## Rate Limits

| Tier | Limit | Applies to |
|------|-------|------------|
| Tier 1 | 1 per minute | Rare admin actions |
| Tier 2 | 20 per minute | Most write operations (`chat:write`) |
| Tier 3 | 50 per minute | Most read operations |
| Tier 4 | 100+ per minute | Search, history reads |

**Best practices:**
- Batch updates into single messages rather than posting many small messages
- Use threads to consolidate related updates
- Add 1-second delays between consecutive write operations
- Cache channel/user IDs — don't look them up repeatedly

## Security Considerations

- **OAuth tokens** are managed by the MCP server — agents never see raw tokens
- **Scope minimization** — request only the scopes agents actually need
- **Channel restrictions** — limit the app to specific channels rather than granting workspace-wide access
- **Audit logging** — Slack Enterprise Grid provides audit logs for all API activity
- **No secrets in messages** — never post tokens, passwords, or credentials in Slack messages (per Constitution #1)

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

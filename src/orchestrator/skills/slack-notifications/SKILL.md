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
| **Package** | [`@kazuph/mcp-slack`](https://www.npmjs.com/package/@kazuph/mcp-slack) |
| **Type** | stdio (spawned via `npx -y @kazuph/mcp-slack`) |
| **Auth** | Bot token (`xoxb-…`) via `SLACK_MCP_XOXB_TOKEN` env var (loaded from `.env` or `envFile`) |
| **Extra env** | `SLACK_MCP_ADD_MESSAGE_TOOL=true` — enables the `conversations_add_message` tool |
| **Supported clients** | VS Code, Claude Code, Cursor, any MCP-compatible client with stdio support |

### Authentication

The `@kazuph/mcp-slack` server supports multiple token types (only one is needed):

| Env Variable | Token Type | Notes |
|-------------|------------|-------|
| `SLACK_MCP_XOXB_TOKEN` | Bot token (`xoxb-…`) | Limited to invited channels only, no search |
| `SLACK_MCP_XOXP_TOKEN` | User OAuth token (`xoxp-…`) | Full access, requires OAuth app setup |
| `SLACK_MCP_XOXC_TOKEN` + `SLACK_MCP_XOXD_TOKEN` | Browser tokens | "Stealth mode" — no app install needed |

This project uses a **bot token** (`SLACK_MCP_XOXB_TOKEN`). Add these under **Bot Token Scopes** in the Slack app configuration:

| Scope | Purpose |
|-------|---------|
| `chat:write` | Post messages and replies |
| `channels:read` | List public channels and their metadata |
| `channels:history` | Read messages in public channels |
| `channels:manage` | Create/rename channels, set topics (optional) |
| `groups:read` | List private channels |
| `groups:history` | Read messages in private channels |
| `im:read` | List direct message conversations |
| `im:history` | Read direct messages |
| `mpim:read` | List group DM conversations |
| `mpim:history` | Read group DMs |
| `users:read` | Look up user profiles |
| `users:read.email` | Look up user emails |

> **Note:** `channels:manage` is optional — only needed if agents should create channels or rename them. Without it, `conversations_create` and `conversations_rename` will return `missing_scope`.
> 
> **Note:** Bot tokens cannot search messages. If search is needed, use a user token (`xoxp-…`) instead.

Admin approval is required. Work with the workspace admin to install the app.

## Available MCP Tools

The Slack MCP server exposes the following tools (prefixed with `mcp_slack_` in VS Code / Copilot):

### Channel Management

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `channels_list` | List workspace channels | `channel_types` (public/private), `limit`, `cursor` |
| `conversations_create` | Create a new channel | `name` (required). Needs `channels:manage` scope |
| `conversations_rename` | Rename a channel | `channel_id`, `name`. Needs `channels:manage` scope |
| `conversations_set_topic` | Set a channel's topic | `channel_id`, `topic` |
| `conversations_invite` | Invite user(s) to a channel | `channel_id`, `users` (comma-separated user IDs) |

### Messaging

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `conversations_add_message` | Post a message to a channel or thread | `channel_id` (ID or name), `payload` (message text), `content_type` (`text/markdown` or `text/plain`, default: `text/markdown`), `thread_ts` (optional, for threading) |
| `conversations_history` | Read recent messages from a channel | `channel_id`, `limit` (time range like `1d`/`7d`/`30d` or message count like `50`), `cursor` |
| `conversations_replies` | Get replies in a thread | `channel_id`, `thread_ts`, `limit`, `cursor` |
| `conversations_search_messages` | Search messages across channels | `search_query`, `filter_in_channel`, `filter_users_from`, `filter_date_before`/`after`/`on`/`during`, `limit` (1-100) |

### Users

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `users_resolve` | Look up a user by name or email | Returns user ID for mentions |

### Channel ID Resolution

The `channel_id` parameter in messaging tools accepts:
- **Channel ID** — e.g., `C0AHAQFJ7C1` (most reliable)
- **Channel name** — e.g., `new-channel` (without `#` prefix)

When a channel name is ambiguous or not found, use `channels_list` first to get the correct ID.

### Key Differences from Documented Slack Web API

- Tool names use `conversations_*` pattern, not `chat.postMessage` etc.
- Message body is sent via `payload` parameter, not `text`
- Message posting is **disabled by default** — requires `SLACK_MCP_ADD_MESSAGE_TOOL=true` env var
- `limit` on history/replies accepts time ranges (`1d`, `7d`, `30d`) or message counts (`50`)
- No reaction tools — reactions are not available via this MCP server
- No canvas tools — canvases are not exposed

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

### Dual-Channel Approval Pattern

Approval requests are always **dual-channel** — posted to Slack AND asked in the chat window. The first response (from either channel) wins.

```
Agent needs approval
 ├─→ Posts to Slack channel/thread
 │     → User replies in Slack
 │     → Agent polls & picks it up ──────┐
 │                                       ▼
 │                                  Agent acts
 │                                       ▲
 └─→ Asks in VS Code chat                │
       → User replies here ──────────────┘
       (immediate, no polling needed)
```

**Why dual-channel:** The chat path is instant (user's next message is the answer). The Slack path covers the case where the user is away from VS Code (mobile, another machine) and wants to unblock the agent remotely.

### Approval Flow

1. **Post to Slack** with a structured approval request:
   ```
   ⏳ **Approval Required**
   Task: TAS-42 — Database migration adds `price_range` column
   Action: Run migration on production database

   Reply in this thread with:
   ✅ "approved" — Approve and proceed
   ❌ "rejected" — Reject and stop
   💬 Or reply with questions
   ```

2. **Ask in chat** — Yield to the user with the same question so they can respond directly in the chat window.

3. **If the user responds in chat** — The agent receives the answer immediately. Post confirmation to the Slack thread:
   ```
   ✅ Approved via VS Code chat. Proceeding.
   ```

4. **If waiting for Slack reply** — While the agent has non-blocked work, poll every 30 seconds:
   - Use `conversations_replies` with the message's `thread_ts`
   - Continue with independent subtasks between polls
   - When a reply arrives, parse it and proceed

5. **If session ends before reply** — Save to checkpoint (see session-checkpoints skill):
   ```markdown
   ## Pending Approvals
   | Provider | Channel | Thread ID | Question | Posted At |
   |----------|---------|-----------|----------|-----------|
   | slack | C0AHAQFJ7C1 | 1772393542.345149 | Run migration on production? | 2026-03-01 14:30 |
   ```
   The next session's `on-session-start` hook checks for replies.

### Reading User Responses

To check for approvals or instructions:

1. Use `conversations_replies` with the `thread_ts` of the approval message to read replies
2. Use `conversations_history` with `oldest`/`latest` time range to find recent directives
3. Thread replies are the primary mechanism — reactions are not available via MCP

### Resolution Rule

- **First response wins** — whether from chat or Slack
- **Cross-post confirmation** — when answered in one channel, post confirmation to the other
- **Conflicting responses** — if both arrive simultaneously, prefer the chat response (it's more intentional)

### Parsing Conventions

| Signal | Meaning |
|--------|---------|
| Thread reply with "approved" / "yes" / "go" | Approved — proceed |
| Thread reply with "rejected" / "no" / "stop" | Rejected — stop and report |
| Thread reply with "reviewing" / "looking" | Acknowledged — user is reviewing |
| Thread reply with detailed text | Instructions or questions |
| `@agent` mention | Direct command or question for the agent |

> **Note:** Reactions (emoji responses) are not available via the Slack MCP server. Use thread replies for all approval workflows.

## Channel & Thread Conventions

### Channel Configuration

Project-specific channel mappings are defined in `.github/customizations/stack/notifications-config.md`. Agents read that file to determine which channel to post to for each event type. Always prefer channel IDs from the config over hardcoded names.

### Default Channel Structure

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

- **Bot tokens** are passed via `SLACK_MCP_XOXB_TOKEN` env var (in `.env` file) — never hardcode in config files or commit to git
- **Scope minimization** — request only the scopes agents actually need (omit `channels:manage` if agents shouldn't create channels)
- **Channel restrictions** — limit the bot to specific channels rather than granting workspace-wide access
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

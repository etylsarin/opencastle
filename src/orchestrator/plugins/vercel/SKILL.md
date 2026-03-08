---
name: vercel-deployment
description: "Vercel deployment workflows, environment management, domain configuration, and build troubleshooting. Use when deploying, checking deployment status, reviewing build logs, or managing environments."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Vercel Deployment

Vercel-specific deployment patterns and MCP tool usage. For project-specific deployment architecture, environment variables, and key files, see [deployment-config.md](../../.opencastle/stack/deployment-config.md).

## Deployment Model

Vercel uses Git-based deployments with automatic preview and production environments:

```
main branch    → Production deployment (auto)
feature/*      → Preview deployment (auto)
fix/*          → Preview deployment (auto)
```

- Every push creates a deployment — no manual triggers needed
- Preview deployments get unique URLs for testing
- Production deploys only from the main branch
- Rollback by redeploying a previous commit

## MCP Tools

The Vercel MCP server provides these tools through `https://mcp.vercel.com`:

| Tool | Purpose | Primary Agents |
|------|---------|----------------|
| `deploy_to_vercel` | Trigger a deployment | DevOps Expert |
| `get_deployment` | Check deployment status and metadata | DevOps, Release Manager |
| `get_deployment_build_logs` | Read build output for debugging | DevOps, Release Manager |
| `get_runtime_logs` | Read runtime logs for debugging | DevOps, Release Manager |
| `list_deployments` | List recent deployments | DevOps, Release Manager |
| `get_project` | Get project configuration | DevOps Expert |
| `list_projects` | List all projects in the team | DevOps Expert |
| `list_teams` | List available teams | DevOps Expert |
| `search_vercel_documentation` | Search Vercel docs | DevOps Expert |
| `check_domain_availability_and_price` | Domain availability check | DevOps Expert |

## Environment Variables

### Vercel Environment Scoping

Vercel supports three environment scopes — set variables for each appropriately:

| Scope | When Applied | Use For |
|-------|-------------|---------|
| **Production** | `main` branch deploys | Live secrets, production API keys |
| **Preview** | All non-production branches | Staging/test API keys |
| **Development** | `vercel dev` local server | Local development overrides |

### Best Practices

- Set secrets via the Vercel dashboard or CLI — never commit them
- Use `NEXT_PUBLIC_*` prefix only for variables safe to expose to the browser
- Verify required env vars exist in all three scopes (production, preview, development)
- Use `.env.local` for local development; never commit this file

## Build Troubleshooting

When builds fail, follow this workflow:

1. **Read build logs** — use `get_deployment_build_logs` to get the full output
2. **Check common causes:**
   - Missing environment variables (works locally but not on Vercel)
   - Node.js version mismatch (check `engines` in `package.json`)
   - Build command mismatch (verify in project settings)
   - Dependency resolution issues (lockfile out of sync)
3. **Check runtime logs** — use `get_runtime_logs` for post-deploy errors
4. **Verify deployment status** — use `get_deployment` to check state and error details

## Domain Configuration

- Use `check_domain_availability_and_price` before purchasing
- Configure domains in the Vercel dashboard
- Always set up both `www` and apex domain with proper redirects
- Enable HTTPS (automatic with Vercel)
- Set appropriate DNS records (CNAME for subdomains, A record for apex)

## Cron Jobs (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/task-name",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

- Protect cron endpoints with `CRON_SECRET` — Vercel sends it in the `Authorization` header
- Maximum execution time depends on plan (10s hobby, 60s pro, 900s enterprise)
- Use `vercel.json` to declare cron schedules — not external schedulers

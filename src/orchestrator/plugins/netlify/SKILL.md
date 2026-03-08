---
name: netlify-deployment
description: "Netlify deployment workflows, serverless functions, edge functions, environment management, and build configuration. Use when deploying to Netlify, writing serverless/edge functions, or troubleshooting builds."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Netlify Deployment

Netlify-specific deployment patterns and conventions. For project-specific deployment architecture, environment variables, and key files, see [deployment-config.md](../../.opencastle/stack/deployment-config.md).

## Deployment Model

Netlify uses Git-based continuous deployment:

```
main branch    → Production deployment (auto)
feature/*      → Deploy preview (auto, unique URL)
fix/*          → Deploy preview (auto, unique URL)
```

- Every push triggers a build — no manual deploys needed
- Deploy previews get unique URLs for PR-based testing
- Instant rollback to any previous deploy from the dashboard
- Branch deploys can be configured for specific branches beyond `main`

## Build Configuration (netlify.toml)

```toml
[build]
  command = "npm run build"
  publish = "dist"              # or ".next", "out", "build"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  conditions = {Role = ["admin"]}

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

## Serverless Functions

Place functions in `netlify/functions/`:

```typescript
// netlify/functions/hello.ts
import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello from Netlify Functions' }),
  };
};
```

- Functions are available at `/.netlify/functions/<name>`
- Supports TypeScript out of the box
- Default timeout: 10s (extendable to 26s on Pro)
- Use background functions for long-running tasks (up to 15 min)

## Edge Functions

Place edge functions in `netlify/edge-functions/`:

```typescript
// netlify/edge-functions/geolocation.ts
import type { Context } from '@netlify/edge-functions';

export default async (request: Request, context: Context) => {
  const { country } = context.geo;
  return new Response(`You're visiting from ${country}`);
};

export const config = { path: '/geo' };
```

- Run at the CDN edge, sub-millisecond cold starts
- Use for personalization, A/B testing, geo-routing
- Deno runtime (not Node.js)

## Environment Variables

### Scoping

| Scope | When Applied | Use For |
|-------|-------------|---------|
| **Production** | `main` deploys | Live secrets, production API keys |
| **Deploy previews** | All PR/branch builds | Staging/test API keys |
| **Branch deploy** | Specific branch deploys | Branch-specific overrides |
| **Local** | `netlify dev` | Local development |

### Best Practices

- Set secrets via Netlify UI or CLI (`netlify env:set`) — never commit them
- Use `netlify dev` to run locally with injected env vars
- Validate required vars at build time in `netlify.toml`

## Scheduled Functions (Cron)

```typescript
// netlify/functions/daily-task.ts
import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  // Run daily task
  return { statusCode: 200, body: 'OK' };
};

export const config = {
  schedule: '0 0 * * *', // Daily at midnight UTC
};
```

## Build Troubleshooting

1. **Check build logs** — Netlify UI → Deploys → click failed deploy
2. **Common causes:**
   - Missing environment variables
   - Node.js version mismatch (set in `netlify.toml` or `.node-version`)
   - Build command or publish directory mismatch
   - Dependency install failures (check lockfile)
3. **Local debugging** — run `netlify build` locally to reproduce
4. **Clear cache** — Netlify UI → Deploys → Trigger deploy → Clear cache and deploy

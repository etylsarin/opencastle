---
name: deployment-infrastructure
description: "Deployment architecture, environment variables, cron jobs, security headers, and caching patterns. Use when configuring deployments, managing environment variables, setting up cron jobs, or troubleshooting build/deployment issues."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Deployment Infrastructure

All deployment configuration is project-specific. See [deployment-config.md](../../customizations/stack/deployment-config.md) for the full architecture, environment variables, cron jobs, caching headers, and key files.

## Generic Deployment Principles

- Use platform-native Git integration for CI/CD (push to main = production, push to branch = preview)
- Store all secrets as environment variables — never in code, commits, or logs
- Use `Bearer` token auth for cron job endpoints
- Apply security headers via framework config (HSTS, CSP, X-Frame-Options, Permissions-Policy)
- Set immutable cache headers for static assets (`max-age=31536000, immutable`)
- Use short cache durations for frequently changing assets (e.g., favicon: `max-age=86400`)
- Load the **security-hardening** skill for full header inventory and CSP configuration

## Environment Variable Management

### Layering & Precedence

Environment variables follow a layered override model (lowest to highest priority):

1. `.env` — shared defaults, committed to repo (no secrets)
2. `.env.local` — developer-specific overrides, git-ignored
3. `.env.production` / `.env.preview` — environment-specific values
4. Platform-injected variables — set in hosting dashboard, highest priority

### Validation at Startup

Validate required variables at application startup. Fail fast with clear messages:

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_SECRET: z.string().min(32),
  PUBLIC_SITE_URL: z.string().url(),
  CRON_SECRET: z.string().min(16),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
```

### Naming & .gitignore

- `PUBLIC_*` or `NEXT_PUBLIC_*` — safe to expose to the browser
- `SECRET_*` or `*_SECRET` — server-only, never bundled into client code
- `CRON_SECRET` — authenticates scheduled job endpoints
- Use `SCREAMING_SNAKE_CASE` for all variable names
- Always gitignore `.env.local`, `.env.*.local`, and `.env.production`

## CI/CD Pipeline Patterns

### Branch-Based Deployment

```
main branch    → Production deployment (auto)
feature/*      → Preview deployment (auto)
fix/*          → Preview deployment (auto)
```

### Generic Pipeline Stages

Every pipeline should include these stages in order:

1. **Install** — restore dependencies from lockfile (`--frozen-lockfile`)
2. **Lint** — static analysis and formatting checks
3. **Test** — unit and integration tests with coverage
4. **Build** — production build (catches type errors and build-time issues)
5. **Deploy** — push artifacts to hosting platform

### Cron Job Authentication

Protect scheduled endpoints with a shared secret:

```typescript
// app/api/cron/route.ts
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... run scheduled task
  return Response.json({ ok: true });
}
```

## Caching Strategy

### Cache Duration Reference

| Asset Type | `Cache-Control` Header | Rationale |
|---|---|---|
| Hashed static assets (JS, CSS) | `public, max-age=31536000, immutable` | Content-addressed filenames; safe to cache forever |
| Images / fonts | `public, max-age=31536000, immutable` | Typically fingerprinted; long-lived |
| Favicon / manifest | `public, max-age=86400` | Changes rarely but should refresh within a day |
| HTML pages (SSG) | `public, max-age=0, must-revalidate` | Serve stale while revalidating |
| API responses | `private, no-cache` | User-specific or frequently changing |
| Prerendered pages (ISR) | `public, s-maxage=3600, stale-while-revalidate=86400` | CDN caches for 1 hour, serves stale for up to 1 day |

Apply cache headers via framework config (e.g., `headers()` in `next.config.js`) or CDN rules. Match each route pattern to the appropriate duration from the table above.

## Security Headers

Apply these headers globally via framework config or middleware. See the **security-hardening** skill for full CSP configuration.

```javascript
// Recommended security headers
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline';" },
];
```

**Key rules:**

- HSTS `max-age` must be at least 1 year (31536000 seconds) for preload eligibility
- `X-Frame-Options: DENY` prevents clickjacking — use `SAMEORIGIN` only if you embed your own pages
- CSP should be as restrictive as possible; expand only when needed, document each exception
- Disable unused browser features via `Permissions-Policy`

## Release Process

### 1. Pre-Release Audit
- Run lint, test, and build for all affected projects (see the **codebase-tool** skill for commands)
- Review all changed files since last release (`git diff` against last tag/release)
- Check for uncommitted work or unmerged branches
- Verify no draft PRs are accidentally included

### 2. Regression Check
- Identify features adjacent to changes and spot-check them
- Run full test suites for all affected projects (not just changed files)
- Check deployment preview builds for visual regressions
- Verify critical user flows still work (e.g., primary navigation, form submissions, authenticated pages)

### 3. Changelog & Release Notes
- Generate changelog from commit messages and PR titles since last release
- Categorize changes: Features, Bug Fixes, Performance, Breaking Changes, Internal
- Write human-readable release notes summarizing impact
- Include migration notes for any breaking changes

### 4. Version Management
- Follow semver: MAJOR (breaking), MINOR (features), PATCH (fixes)
- Tag releases in git with the version number
- Update version references in relevant files

### 5. Release Verification
- Confirm deployment succeeded on production
- Smoke-test production URLs for critical pages
- Monitor error rates and performance metrics post-release
- Have rollback steps documented and ready (see § Rollback Procedures)

## Rollback Procedures

**Two rollback strategies** (prefer platform-level when available):

1. **Platform rollback** — promote the last known-good deployment from the hosting dashboard
2. **Git revert** — `git revert -m 1 HEAD && git push origin main` (triggers a clean redeploy)

### Rollback Checklist

- [ ] Confirm the issue is deployment-related (not a data or third-party issue)
- [ ] Roll back via platform or git revert — never force-push to `main`
- [ ] Verify the rollback deployment is healthy (smoke tests)
- [ ] Notify the team with a summary of what was rolled back and why
- [ ] Create a post-mortem ticket to investigate root cause

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|---|---|---|
| Hardcoding secrets in source code | Secrets leak via git history, logs, and client bundles | Use environment variables; validate with Zod at startup |
| Skipping preview deployments | Bugs reach production without visual review | Deploy every branch to a preview environment |
| Using `Cache-Control: no-store` everywhere | Destroys performance; every request hits origin | Use appropriate cache durations per asset type (see table above) |
| Force-pushing to `main` to "fix" a bad deploy | Destroys git history; breaks other developers' branches | Use `git revert` to cleanly undo changes |
| Disabling security headers "temporarily" | Temporary becomes permanent; opens attack surface | Keep headers strict; expand only with documented exceptions |
| Running builds without `--frozen-lockfile` | Non-deterministic installs; works locally, fails in CI | Always use `--frozen-lockfile` (or equivalent) in CI |
| Storing `.env.local` in the repository | Developer secrets and tokens leak to all contributors | Add `.env.local` to `.gitignore`; share via secure vault |
| No startup validation of env vars | App starts but crashes later with cryptic errors | Validate all required variables at boot (fail fast) |

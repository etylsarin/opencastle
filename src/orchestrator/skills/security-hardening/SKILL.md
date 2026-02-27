---
name: security-hardening
description: "Security architecture including authentication, authorization, RLS policies, security headers, CSP, input validation, API security, and OAuth patterns. Use when implementing auth flows, writing RLS policies, configuring security headers, validating inputs, or auditing security."
---

# Security Hardening

## Security Architecture

```
Vercel Edge Network (WAF, DDoS)
  → Security Headers (next.config.js: HSTS, CSP, X-Frame-Options)
    → Middleware (proxy.ts: session refresh)
      → Server Actions (Supabase Auth: CSRF protection)
        → RLS Policies (row-level authorization)
```

| Layer | Technology | Protection |
|-------|-----------|------------|
| Edge | Vercel WAF | DDoS, bot detection |
| Headers | Next.js config | HSTS, CSP, XSS protection |
| Middleware | proxy.ts | Session management |
| Server Actions | Supabase Auth | Authentication, CSRF |
| Database | RLS Policies | Row-level authorization |
| API Routes | CRON_SECRET | Cron job authorization |
| Input | Zod | Schema validation |
| Rate Limiting | Proxy layer | IP-based throttling |

## Authentication

**Platform:** Supabase Auth with Server Actions pattern.

- **Server Actions** for sign in/up/out, session management.
- **Middleware** for session refresh, protected routes.
- **RLS Policies** in Postgres.
- **OAuth providers:** Google, Facebook (configured in Supabase dashboard)
- **User roles:** `user`, `moderator`, `admin` (stored in `profiles.roles TEXT[]`)
- **Key auth files:** `libs/supabase-auth/src/actions/auth.ts`, `apps/*/proxy.ts`
- **Cron authorization:** `CRON_SECRET` env var, `Bearer` token in `authorization` header

### Server Actions Pattern Benefits

- Automatic CSRF protection (Next.js POST-only Server Actions).
- No exposed API endpoints for auth.
- Server-side session management.

### Session Management

- HTTP-only cookies (Supabase client managed).
- Automatic refresh via middleware (`updateSession()`).
- Sign out clears cookie and invalidates session.

## Content Security Policy

### Allowed External Domains (`next.config.js`)

| Purpose | Domains |
|---------|--------|
| Scripts | `challenges.cloudflare.com`, `cdn.jsdelivr.net`, `cdn.sanity.io`, `maps.googleapis.com` |
| Styles | `cdn.jsdelivr.net`, `fonts.googleapis.com` |
| Fonts | `fonts.gstatic.com` |
| Frames | `challenges.cloudflare.com` |

### Directives

General CSP directives follow the principle of least privilege:
- `default-src 'self'` — deny by default.
- Whitelist only required external domains per directive.
- `object-src 'none'` — block plugins.
- `frame-ancestors 'self'` — prevent clickjacking.
- `upgrade-insecure-requests` — enforce HTTPS.

**Known weaknesses:** `'unsafe-inline'` and `'unsafe-eval'` in script-src (required for Next.js dev mode). Consider nonces/hashes for production inline scripts.

## RLS Policy Patterns

> **Detailed RLS patterns and SQL examples:** See the **supabase-database** skill, which is the authoritative source for RLS policies, role systems, and migration rules.

### Best Practices

- Enable RLS on all tables: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- Test policies with different user roles.
- Use `auth.uid()` for authentication checks.
- EXISTS subqueries for role checks.
- Never rely solely on client-side authorization.
- Never disable RLS in production.

## API Security

### Cron Job Authorization

```typescript
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

- Strong random CRON_SECRET: `openssl rand -hex 32`
- Rotate quarterly.

### Input Validation

- Zod schemas for all request validation.
- React Hook Form for client-side validation.
- Server-side validation in all Server Actions and route handlers.

## Critical Rules

1. Never commit secrets — use Vercel environment variables.
2. Always use Server Actions for auth operations.
3. Enable RLS on all tables — default-deny, explicit-allow.
4. Validate all inputs with Zod before database operations.
5. Sanitize user content — escape HTML in reviews/descriptions.
6. Parameterized queries (Supabase client handles automatically).
7. Rotate secrets regularly (quarterly).

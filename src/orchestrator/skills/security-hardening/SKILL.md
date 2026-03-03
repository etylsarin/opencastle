---
name: security-hardening
description: "Security architecture including authentication, authorization, RLS policies, security headers, CSP, input validation, API security, and OAuth patterns. Use when implementing auth flows, writing RLS policies, configuring security headers, validating inputs, or auditing security."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Security Hardening

## Security Architecture

```
Edge Network (WAF, DDoS)
  → Security Headers (framework config: HSTS, CSP, X-Frame-Options)
    → Middleware (session refresh)
      → Server Actions (Auth: CSRF protection)
        → RLS Policies (row-level authorization)
```

| Layer | Role | Protection |
|-------|------|------------|
| Edge | WAF / CDN | DDoS, bot detection |
| Headers | Framework config | HSTS, CSP, XSS protection |
| Middleware | Proxy / middleware layer | Session management |
| Server Actions | Auth provider | Authentication, CSRF |
| Database | RLS Policies | Row-level authorization |
| API Routes | CRON_SECRET | Cron job authorization |
| Input | Zod | Schema validation |
| Rate Limiting | Proxy layer | IP-based throttling |

## Authentication

**Platform:** Auth provider with Server Actions pattern. Resolve specific auth library and configuration via the **database** capability slot in the skill matrix.

- **Server Actions** for sign in/up/out, session management.
- **Middleware** for session refresh, protected routes.
- **RLS Policies** in the database.
- **OAuth providers:** Configured in the auth provider's dashboard.
- **User roles:** Stored in the user profiles table (e.g., `profiles.roles TEXT[]`).
- **Key auth files:** Resolve via project-specific customization files.
- **Cron authorization:** `CRON_SECRET` env var, `Bearer` token in `authorization` header

### Server Actions Pattern Benefits

- Automatic CSRF protection (POST-only Server Actions).
- No exposed API endpoints for auth.
- Server-side session management.

### Session Management

- HTTP-only cookies (auth client managed).
- Automatic refresh via middleware (`updateSession()`).
- Sign out clears cookie and invalidates session.

## Content Security Policy

### Allowed External Domains (framework config)

| Purpose | Domains |
|---------|--------|
| Scripts | Project-specific — see deployment customization |
| Styles | Project-specific — see deployment customization |
| Fonts | Project-specific — see deployment customization |
| Frames | Project-specific — see deployment customization |

### Directives

General CSP directives follow the principle of least privilege:
- `default-src 'self'` — deny by default.
- Whitelist only required external domains per directive.
- `object-src 'none'` — block plugins.
- `frame-ancestors 'self'` — prevent clickjacking.
- `upgrade-insecure-requests` — enforce HTTPS.

**Known weaknesses:** `'unsafe-inline'` and `'unsafe-eval'` in script-src (may be required for framework dev mode). Consider nonces/hashes for production inline scripts.

## RLS Policy Patterns

> **Detailed RLS patterns and SQL examples:** See the **database** skill (resolved via skill matrix), which is the authoritative source for RLS policies, role systems, and migration rules.

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

1. Never commit secrets — use deployment platform environment variables.
2. Always use Server Actions for auth operations.
3. Enable RLS on all tables — default-deny, explicit-allow.
4. Validate all inputs with Zod before database operations.
5. Sanitize user content — escape HTML in reviews/descriptions.
6. Parameterized queries (database client handles automatically).
7. Rotate secrets regularly (quarterly).

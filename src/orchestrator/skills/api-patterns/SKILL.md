---
name: api-patterns
description: "API design patterns for route handlers, Server Actions, Zod validation, and external API integration. Use when creating API routes, Server Actions, or integrating external services."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# API Patterns

Generic API design patterns for Next.js App Router projects. For project-specific endpoints, actions, and external API inventory, see [api-config.md](../../customizations/stack/api-config.md).

## Architecture

This project uses **Next.js App Router** API patterns:

- **Server Actions** (preferred for mutations) — form submissions, data writes, auth operations
- **Route Handlers** (`route.ts`) — analytics endpoints, autocomplete, external integrations
- **Proxy layer** — IP rate limiting, fingerprinting, bot detection

## Code Patterns

### Route Handler

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({ query: z.string().min(1).max(200) });

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  // ... process
  return NextResponse.json(data);
}
```

### Server Action

```typescript
'use server';
import { createServerClient } from '@libs/supabase-auth';
import { revalidatePath } from 'next/cache';

export async function submitAction(formData: FormData) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };
  // ... validate and process
  revalidatePath('/places');
  return { success: true };
}
```

## Design Principles

- Prefer Server Actions for mutations over API routes
- Always validate input with Zod schemas on the server side
- Return appropriate HTTP status codes and error messages
- Protect sensitive routes with middleware or role checks
- Rate limit public endpoints to prevent abuse
- Use Web `Request`/`Response` APIs with `NextRequest`/`NextResponse`
- Use CDN caching headers for public, cacheable responses
- Document new API endpoints in project documentation

## API Design Principles

### Route Architecture
- RESTful resource naming: `/api/v1/places`, `/api/v1/places/:slug`
- Use HTTP methods correctly: `GET` (read), `POST` (create), `PATCH` (partial update), `DELETE` (remove)
- Group related endpoints under a common prefix
- Keep URLs noun-based, not verb-based (`/api/places` not `/api/getPlaces`)

### Request/Response Schemas
- Define Zod schemas for all request bodies, query params, and responses
- Use consistent envelope format for responses:
  ```json
  { "data": ..., "meta": { "total": 42, "page": 1 } }
  ```
- Error responses follow a standard shape:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
  ```

### Error Handling
- Use appropriate HTTP status codes (400, 401, 403, 404, 422, 429, 500)
- Return machine-readable error codes alongside human-readable messages
- Never leak internal errors — sanitize stack traces in production
- Provide actionable error messages when possible

### Pagination & Filtering
- Cursor-based pagination for large datasets (offset-based as fallback)
- Consistent query parameter names: `limit`, `cursor`, `sort`, `order`
- Filter parameters match field names: `?type=brewery&city=prague`

### Versioning
- URL-based versioning: `/api/v1/...`
- Never break existing contracts — add fields, never remove or rename
- Deprecation notices in response headers before removal

### Rate Limiting & Caching
- Define rate limits per endpoint sensitivity
- Set `Cache-Control` headers appropriate to content freshness
- Use `ETag` / `If-None-Match` for conditional requests where applicable

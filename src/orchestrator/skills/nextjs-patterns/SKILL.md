---
name: nextjs-patterns
description: "Next.js App Router best practices for server/client components, routing, API routes, and project structure. Use when creating or modifying Next.js pages, layouts, route handlers, or Server Actions."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Next.js Patterns (2025)

## Project Structure

- **Use `app/` directory** (App Router) for all routes.
- Top-level: `app/`, `public/`, `lib/`, `components/`, `contexts/`, `styles/`, `hooks/`, `types/`.
- Colocate files near where they're used.
- **Route Groups**: parentheses `(admin)` — group without affecting URL.
- **Private Folders**: underscore `_internal` — opt out of routing.
- Feature folders for large apps: `app/dashboard/`, `app/auth/`.

## Server and Client Components

**Default: Server Components** — data fetching, heavy logic, non-interactive UI.

**Client Components** — add `'use client'` at top. Use for interactivity, state, browser APIs.

### Critical Rule

**Never use `next/dynamic` with `{ ssr: false }` inside a Server Component.** This causes build/runtime errors.

**Correct approach:**
1. Move all client-only logic into a dedicated Client Component (`'use client'`).
2. Import and use that Client Component directly in the Server Component.

```tsx
// Server Component
import DashboardNavbar from '@/components/DashboardNavbar';

export default async function DashboardPage() {
  return (
    <>
      <DashboardNavbar /> {/* Client Component */}
    </>
  );
}
```

## Component Practices

- PascalCase for files/exports. camelCase for hooks.
- Shared components in `components/`. Route-specific in route folder.
- TypeScript interfaces for props. Explicit types and defaults.
- Co-locate tests with components.

## Naming Conventions

- Folders: `kebab-case`.
- Components: `PascalCase`. Hooks: `camelCase`. Assets: `kebab-case`.
- Types/Interfaces: `PascalCase`. Constants: `UPPER_SNAKE_CASE`.

## API Routes (Route Handlers)

- Location: `app/api/` (e.g., `app/api/users/route.ts`).
- Export async functions named after HTTP verbs (`GET`, `POST`, etc.).
- Use Web `Request`/`Response` APIs. `NextRequest`/`NextResponse` for advanced features.
- Dynamic segments: `[param]`.
- Validate with Zod/Yup. Return appropriate status codes.
- Protect sensitive routes with middleware or server-side session checks.

## General Best Practices

- TypeScript with `strict` mode.
- ESLint with official Next.js config.
- Secrets in `.env.local` — never committed.
- Built-in Image and Font optimization.
- Suspense and loading states for async data.
- Avoid large client bundles — keep logic in Server Components.
- Semantic HTML and ARIA attributes.
- Do NOT create example/demo files unless explicitly requested.

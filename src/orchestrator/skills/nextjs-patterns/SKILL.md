---
name: nextjs-patterns
description: "Next.js App Router best practices for server/client components, routing, API routes, and project structure. Use when creating or modifying Next.js pages, layouts, route handlers, or Server Actions."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Next.js Patterns (2025)

## Project Structure

- **Use `app/` directory** (App Router) for all routes; colocate files near where they're used.
- Top-level: `app/`, `public/`, `lib/`, `components/`, `contexts/`, `styles/`, `hooks/`, `types/`.
- **Route Groups** `(admin)` — group without affecting URL. **Private Folders** `_internal` — opt out of routing.
- Feature folders for large apps: `app/dashboard/`, `app/auth/`.

## Server and Client Components

**Default: Server Components** — data fetching, heavy logic, non-interactive UI.

**Client Components** — add `'use client'` at top. Use for interactivity, state, browser APIs.

### Decision Table

| Need | Component Type | Why |
|------|---------------|-----|
| Fetch data at request time | Server | Direct DB/API access, no client waterfall |
| Read cookies/headers | Server | Available only on the server |
| Interactive UI (clicks, inputs) | Client | Requires event handlers |
| Use `useState` / `useEffect` | Client | React hooks need client runtime |
| Access browser APIs (localStorage, geolocation) | Client | Not available on server |
| Render static/non-interactive content | Server | Smaller bundle, faster paint |
| Show loading spinners for async children | Server (with `<Suspense>`) | Streams HTML progressively |

### Critical Rule

**Never use `next/dynamic` with `{ ssr: false }` inside a Server Component.** This causes build/runtime errors.

**Correct approach:** Move client-only logic into a dedicated `'use client'` component, then import it normally.

```tsx
// Server Component — imports a Client Component directly
import DashboardNavbar from '@/components/DashboardNavbar';
export default async function DashboardPage() {
  return <><DashboardNavbar /></>;
}
```

## Data Fetching Patterns

### Server-Side Fetching

Fetch directly in `async` Server Components. Next.js deduplicates identical `fetch` calls.

```tsx
export default async function ProjectsPage() {
  const projects = await fetch('https://api.example.com/projects', {
    next: { revalidate: 60 }, // ISR: revalidate every 60s
  }).then((res) => res.json());
  return <ul>{projects.map((p: { id: string; name: string }) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

### Server Actions (mutations)

Define with `'use server'`. Call from Client Components via `action` or `startTransition`.

```tsx
// lib/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
export async function createItem(formData: FormData) {
  const name = formData.get('name') as string;
  await db.items.create({ data: { name } });
  revalidatePath('/items');
}
```

```tsx
// components/CreateItemForm.tsx — calls the Server Action
'use client';
import { createItem } from '@/lib/actions';
export default function CreateItemForm() {
  return <form action={createItem}><input name="name" required /><button type="submit">Add</button></form>;
}
```

## Error Handling

Each route segment can export `error.tsx` (must be a Client Component) and `not-found.tsx`.

```tsx
// app/dashboard/error.tsx — must be a Client Component
'use client';
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return <div role="alert"><h2>Something went wrong</h2><button onClick={reset}>Try again</button></div>;
}
```

```tsx
// app/projects/[id]/page.tsx — use notFound() to trigger not-found.tsx
import { notFound } from 'next/navigation';
export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) notFound();
  return <h1>{project.name}</h1>;
}
```

## Middleware

Place `middleware.ts` at the project root (next to `app/`). Runs before every matched request.

```ts
import { NextResponse, type NextRequest } from 'next/server';
export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/dashboard/:path*', '/settings/:path*'] };
```

## Component Practices & Naming

- PascalCase for component files/exports. camelCase for hooks.
- Shared components in `components/`. Route-specific in route folder.
- TypeScript interfaces for props. Explicit types and defaults.
- Co-locate tests with components.
- Folders: `kebab-case`. Types/Interfaces: `PascalCase`. Constants: `UPPER_SNAKE_CASE`.

## API Routes (Route Handlers)

- Location: `app/api/` (e.g., `app/api/users/route.ts`).
- Export async functions named after HTTP verbs (`GET`, `POST`, etc.).
- Use Web `Request`/`Response` APIs. `NextRequest`/`NextResponse` for advanced features.
- Dynamic segments: `[param]`.
- Validate with Zod/Yup. Return appropriate status codes.
- Protect sensitive routes with middleware or server-side session checks.

## Performance Patterns

### Dynamic Imports (Client Components only)

Lazy-load heavy Client Components to reduce initial bundle size.

```tsx
'use client';
import dynamic from 'next/dynamic';
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <p>Loading chart…</p>,
});
```

### Parallel Data Fetching

Initiate independent fetches simultaneously — don't `await` sequentially.

```tsx
export default async function DashboardPage() {
  const [metrics, activity] = await Promise.all([getMetrics(), getRecentActivity()]);
  return <><MetricsPanel data={metrics} /><ActivityFeed items={activity} /></>;
}
```

### Streaming with Suspense

Wrap slow data sections in `<Suspense>` so the shell renders immediately.

```tsx
import { Suspense } from 'react';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <main><Suspense fallback={<p>Loading…</p>}>{children}</Suspense></main>;
}
```

## General Best Practices

- TypeScript with `strict` mode. ESLint with official Next.js config.
- Secrets in `.env.local` — never committed.
- Built-in Image and Font optimization.
- Suspense and loading states for async data.
- Avoid large client bundles — keep logic in Server Components.
- Semantic HTML and ARIA attributes.
- Do NOT create example/demo files unless explicitly requested.

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Do This Instead |
|-------------|---------------|-----------------|
| `'use client'` on every component | Bloats JS bundle, defeats RSC benefits | Default to Server Components; add `'use client'` only when needed |
| Sequential `await` for independent data | Creates a waterfall, slows page load | Use `Promise.all()` for parallel fetches |
| `next/dynamic` with `ssr: false` in Server Components | Build/runtime crash | Extract to a Client Component, import normally |
| Fetching in `useEffect` when server fetch works | Extra client roundtrip, loading flash | Fetch in the Server Component or use Server Actions |
| Giant `layout.tsx` with all providers | Hard to test, couples unrelated concerns | Split providers into a `Providers` Client Component |
| Catching errors without `error.tsx` | Unhandled errors crash the page | Add `error.tsx` per route segment |
| Hardcoding secrets in source files | Security risk, leaks in version control | Use `.env.local` and `process.env` |
| Skipping `loading.tsx` / `<Suspense>` | Blank screen while data loads | Add `loading.tsx` or wrap in `<Suspense>` |

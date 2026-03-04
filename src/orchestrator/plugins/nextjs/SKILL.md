---
name: nextjs-framework
description: "Next.js framework best practices covering App Router, server/client components, data fetching, caching, rendering strategies, middleware, configuration, and deployment. Use when creating or modifying Next.js pages, layouts, route handlers, Server Actions, or project configuration."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Next.js Framework

## Project Structure

```
├── app/                     # App Router (file-based routing)
│   ├── layout.tsx           # Root layout (required)
│   ├── page.tsx             # Home route → /
│   ├── loading.tsx          # Loading UI (Suspense boundary)
│   ├── error.tsx            # Error boundary (Client Component)
│   ├── not-found.tsx        # 404 page
│   ├── global-error.tsx     # Root error boundary
│   ├── (marketing)/         # Route group (no URL segment)
│   │   ├── about/page.tsx   # → /about
│   │   └── blog/page.tsx    # → /blog
│   ├── dashboard/
│   │   ├── layout.tsx       # Nested layout
│   │   ├── page.tsx         # → /dashboard
│   │   └── [id]/page.tsx    # → /dashboard/:id
│   └── api/
│       └── users/route.ts   # API route handler
├── components/              # Shared React components
├── lib/                     # Utilities, helpers, server logic
├── public/                  # Static assets (served as-is)
├── next.config.ts           # Next.js configuration
├── middleware.ts            # Edge middleware
└── .env.local               # Environment variables (not committed)
```

- **Route Groups** `(name)` — organize routes without affecting the URL.
- **Private Folders** `_internal` — opt out of routing entirely.
- **Parallel Routes** `@modal` — render multiple pages in the same layout.
- **Intercepting Routes** `(.)photo` — intercept navigation to show modals.

## Rendering Strategies

Next.js supports multiple rendering strategies per route:

| Strategy | When | How |
|----------|------|-----|
| **Static (SSG)** | Build time | Default for pages with no dynamic data |
| **Incremental Static Regeneration (ISR)** | Build + revalidation | `fetch` with `next: { revalidate: N }` or route segment config |
| **Server-Side Rendering (SSR)** | Every request | `export const dynamic = 'force-dynamic'` or dynamic functions (`cookies()`, `headers()`) |
| **Client-Side Rendering (CSR)** | Browser | `'use client'` components with `useEffect`/SWR |
| **Streaming** | Progressive | `<Suspense>` boundaries + `loading.tsx` |
| **Partial Prerendering (PPR)** | Build + streaming | Static shell with dynamic holes via `<Suspense>` |

### Route Segment Config

Control per-route rendering behavior:

```tsx
// app/dashboard/page.tsx
export const dynamic = 'force-dynamic';        // SSR every request
export const revalidate = 60;                   // ISR: revalidate every 60s
export const fetchCache = 'default-cache';      // Cache fetch requests
export const runtime = 'nodejs';                // 'nodejs' | 'edge'
```

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

**Never use `next/dynamic` with `{ ssr: false }` inside a Server Component.** Move client-only logic into a dedicated `'use client'` component, then import it normally.

## Data Fetching

### Server-Side Fetching

Fetch directly in `async` Server Components. Next.js deduplicates identical `fetch` calls.

```tsx
export default async function ProjectsPage() {
  const projects = await fetch('https://api.example.com/projects', {
    next: { revalidate: 60 },
  }).then((res) => res.json());
  return <ul>{projects.map((p: { id: string; name: string }) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

### Server Actions (Mutations)

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
// components/CreateItemForm.tsx
'use client';
import { createItem } from '@/lib/actions';
export default function CreateItemForm() {
  return <form action={createItem}><input name="name" required /><button type="submit">Add</button></form>;
}
```

### Parallel Data Fetching

Initiate independent fetches simultaneously — never `await` sequentially.

```tsx
export default async function DashboardPage() {
  const [metrics, activity] = await Promise.all([getMetrics(), getRecentActivity()]);
  return <><MetricsPanel data={metrics} /><ActivityFeed items={activity} /></>;
}
```

## Caching and Revalidation

| Mechanism | Scope | How to Use |
|-----------|-------|------------|
| **Request Memoization** | Per-request | Automatic deduplication of identical `fetch` calls |
| **Data Cache** | Cross-request | `fetch` results cached by default; opt out with `cache: 'no-store'` |
| **Full Route Cache** | Build time | Static routes cached as HTML + RSC payload |
| **Router Cache** | Client-side | Prefetched and visited routes cached in browser |

### Revalidation

```tsx
// Time-based — revalidate every 60 seconds
fetch(url, { next: { revalidate: 60 } });

// On-demand — revalidate by path or tag
import { revalidatePath, revalidateTag } from 'next/cache';
revalidatePath('/blog');
revalidateTag('posts');

// Tag a fetch for on-demand revalidation
fetch(url, { next: { tags: ['posts'] } });
```

## Routing

### File Conventions

| File | Purpose |
|------|---------|
| `page.tsx` | Route UI (makes segment publicly accessible) |
| `layout.tsx` | Shared layout (wraps children, persists across navigation) |
| `template.tsx` | Like layout but re-mounts on navigation |
| `loading.tsx` | Loading UI (automatic Suspense boundary) |
| `error.tsx` | Error UI (Client Component, automatic error boundary) |
| `not-found.tsx` | 404 UI |
| `route.ts` | API endpoint (no UI) |
| `default.tsx` | Fallback for parallel routes |

### Dynamic Routes

```
app/blog/[slug]/page.tsx        → /blog/:slug
app/shop/[...slug]/page.tsx     → /shop/:slug+ (catch-all)
app/shop/[[...slug]]/page.tsx   → /shop or /shop/:slug+ (optional catch-all)
```

### Route Handlers (API Routes)

```ts
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q');
  const users = await findUsers(query);
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const user = await createUser(body);
  return NextResponse.json(user, { status: 201 });
}
```

## Error Handling

```tsx
// app/dashboard/error.tsx — must be a Client Component
'use client';
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return <div role="alert"><h2>Something went wrong</h2><button onClick={reset}>Try again</button></div>;
}
```

```tsx
// app/projects/[id]/page.tsx — trigger not-found boundary
import { notFound } from 'next/navigation';
export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) notFound();
  return <h1>{project.name}</h1>;
}
```

## Middleware

Runs at the Edge before every matched request. Use for auth, redirects, rewrites, headers.

```ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  // Add custom headers
  const response = NextResponse.next();
  response.headers.set('x-request-id', crypto.randomUUID());
  return response;
}

export const config = { matcher: ['/dashboard/:path*', '/settings/:path*'] };
```

## Configuration

### `next.config.ts`

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.example.com' },
    ],
  },
  experimental: {
    ppr: true,                    // Partial Prerendering
    typedRoutes: true,            // Type-safe <Link> hrefs
  },
  // Redirects, rewrites, headers
  async redirects() {
    return [{ source: '/old-path', destination: '/new-path', permanent: true }];
  },
};

export default nextConfig;
```

### Environment Variables

| Prefix | Available in | Use Case |
|--------|-------------|----------|
| `NEXT_PUBLIC_` | Server + Client | Public values (API base URLs, feature flags) |
| No prefix | Server only | Secrets (DB URLs, API keys, tokens) |

Files loaded (in priority order): `.env.local`, `.env.development` / `.env.production`, `.env`.

## Image and Font Optimization

### Images

```tsx
import Image from 'next/image';
import heroImg from '@/public/hero.jpg';

// Local image — auto width/height from import
<Image src={heroImg} alt="Hero" priority />

// Remote image — must specify dimensions
<Image src="https://cdn.example.com/photo.jpg" alt="Photo" width={800} height={600} />
```

### Fonts

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={inter.className}><body>{children}</body></html>;
}
```

## Metadata and SEO

```tsx
// app/layout.tsx — static metadata
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'My App', template: '%s | My App' },
  description: 'App description',
  openGraph: { title: 'My App', description: 'App description', type: 'website' },
};
```

```tsx
// app/blog/[slug]/page.tsx — dynamic metadata
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  return { title: post.title, description: post.excerpt };
}
```

## Performance Patterns

- **Default to Server Components** — smaller client bundles, faster paint.
- **`<Suspense>` + `loading.tsx`** — stream content progressively; never block the whole page.
- **`Promise.all()`** — parallel data fetching for independent data.
- **Dynamic imports** — lazy-load heavy Client Components with `next/dynamic`.
- **`<Image>`** — automatic lazy loading, responsive sizing, format conversion.
- **`next/font`** — zero layout shift, self-hosted fonts.
- **Route segment config** — fine-tune caching and rendering per route.

## Deployment

Next.js deploys to multiple targets:

| Target | Config | Notes |
|--------|--------|-------|
| **Vercel** | Zero-config | Full feature support including Edge, ISR, Middleware |
| **Node.js server** | `output: 'standalone'` | Minimal `standalone/` folder with server |
| **Docker** | `output: 'standalone'` | Copy `.next/standalone` + `.next/static` + `public` |
| **Static export** | `output: 'export'` | No server features (no SSR, API routes, middleware) |

## Component Practices & Naming

- PascalCase for component files/exports. camelCase for hooks.
- Shared components in `components/`. Route-specific components co-located in route folder.
- TypeScript interfaces for props. Explicit types and defaults.
- Co-locate tests with components.
- Folders: `kebab-case`. Types/Interfaces: `PascalCase`. Constants: `UPPER_SNAKE_CASE`.

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
| Using `getServerSideProps` / `getStaticProps` | Legacy Pages Router patterns | Use App Router with `async` Server Components |
| Ignoring `next.config.ts` for images | Remote images blocked by default | Configure `images.remotePatterns` |
| Missing `metadata` exports | Poor SEO, no social previews | Export `metadata` or `generateMetadata` per page |

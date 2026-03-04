---
name: astro-framework
description: "Astro framework best practices for content-driven sites, islands architecture, routing, integrations, and project structure. Use when creating or modifying Astro pages, layouts, components, or content collections."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Astro Framework

## Project Structure

- **Use `src/pages/` directory** for file-based routing. Each `.astro`, `.md`, or `.mdx` file becomes a route.
- Top-level: `src/`, `public/`, `astro.config.mjs`.
- Inside `src/`: `pages/`, `layouts/`, `components/`, `content/`, `styles/`, `assets/`.
- **`public/`** — static assets served as-is (favicons, robots.txt, fonts).
- **`src/assets/`** — images and assets processed by Astro's build pipeline.

```
src/
├── pages/
│   ├── index.astro          # → /
│   ├── about.astro           # → /about
│   └── blog/
│       ├── index.astro       # → /blog
│       └── [slug].astro      # → /blog/:slug
├── layouts/
│   └── BaseLayout.astro
├── components/
│   ├── Header.astro
│   └── Counter.tsx           # React island
├── content/
│   └── blog/                 # Content collection
│       ├── first-post.md
│       └── second-post.md
└── styles/
    └── global.css
```

## Component Model

**Default: Zero JS** — Astro components (`.astro`) render to HTML with no client-side JavaScript.

**Islands Architecture** — Interactive components use `client:*` directives to hydrate only where needed.

### Astro Components

```astro
---
// Component script (runs at build time / server)
interface Props {
  title: string;
  description?: string;
}
const { title, description = 'Default description' } = Astro.props;
const data = await fetch('https://api.example.com/data').then(r => r.json());
---

<section>
  <h2>{title}</h2>
  <p>{description}</p>
  <ul>
    {data.items.map((item: { id: string; name: string }) => (
      <li>{item.name}</li>
    ))}
  </ul>
</section>

<style>
  /* Scoped by default */
  section { max-width: 800px; margin: 0 auto; }
</style>
```

### Client Directives (Islands)

| Directive | When It Hydrates | Use Case |
|-----------|-----------------|----------|
| `client:load` | Immediately on page load | Critical interactive UI |
| `client:idle` | After page is idle | Non-critical UI (analytics widgets) |
| `client:visible` | When element enters viewport | Below-the-fold components |
| `client:media="(max-width: 768px)"` | When media query matches | Mobile-only interactivity |
| `client:only="react"` | Client-only, no SSR | Components that can't server-render |

```astro
---
import Counter from '../components/Counter.tsx';
import HeavyChart from '../components/HeavyChart.tsx';
---

<!-- Hydrates immediately -->
<Counter client:load />

<!-- Hydrates when visible -->
<HeavyChart client:visible />
```

## Content Collections

Define collections in `src/content.config.ts` (Astro v5+) using the Content Layer API:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
```

### Querying Collections

```astro
---
import { getCollection, getEntry } from 'astro:content';

// All published posts, sorted by date
const posts = (await getCollection('blog', ({ data }) => !data.draft))
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

// Single entry
const entry = await getEntry('blog', 'first-post');
---
```

## Routing

### Static Routes

Every `.astro` or `.md` file in `src/pages/` becomes a route.

### Dynamic Routes

```astro
---
// src/pages/blog/[slug].astro
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map(post => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---

<Content />
```

### Server-Side Rendering (On-Demand)

Enable SSR with an adapter in `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server', // or 'hybrid' for mixed static + server
  adapter: node({ mode: 'standalone' }),
});
```

## Layouts

```astro
---
// src/layouts/BaseLayout.astro
interface Props {
  title: string;
  description?: string;
}
const { title, description = 'My Astro Site' } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

## Integrations

Use `astro add` for official integrations:

```bash
npx astro add react        # Add React support
npx astro add tailwind     # Add Tailwind CSS v4
npx astro add mdx          # Add MDX support
npx astro add sitemap      # Add sitemap generation
npx astro add node         # Add Node.js SSR adapter
npx astro add vercel       # Add Vercel adapter
npx astro add netlify      # Add Netlify adapter
npx astro add cloudflare   # Add Cloudflare adapter
```

## API Routes (Endpoints)

```ts
// src/pages/api/search.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q');
  const results = await searchDatabase(query);
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  // handle mutation
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
```

## Actions (Server Mutations)

Define type-safe server actions in `src/actions/index.ts`:

```ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';

export const server = {
  subscribe: defineAction({
    accept: 'form',
    input: z.object({ email: z.string().email() }),
    handler: async ({ email }) => {
      await addToNewsletter(email);
      return { success: true };
    },
  }),
};
```

## Performance Patterns

- **Zero JS by default** — only ship JavaScript for interactive islands.
- **Image optimization** — use `astro:assets` for automatic image optimization.
- **View Transitions** — use `<ViewTransitions />` for smooth page navigation.
- **Prefetching** — enabled by default for visible links.
- **CSS scoping** — styles in `.astro` files are scoped automatically.

```astro
---
import { Image } from 'astro:assets';
import heroImage from '../assets/hero.jpg';
---

<Image src={heroImage} alt="Hero" width={800} />
```

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Do This Instead |
|-------------|---------------|-----------------|
| `client:load` on every component | Defeats zero-JS benefit, bloats bundle | Use `client:idle` or `client:visible` for non-critical UI |
| Importing large JS libraries in `.astro` | Runs at build but bundles nothing useful | Import in framework components with `client:*` |
| Skipping content collections for blog/docs | Manual file handling is error-prone | Use content collections with typed schemas |
| Hardcoding data in pages | Not maintainable, no type safety | Use content collections or fetch from APIs |
| Using `client:only` when SSR works | Loses SEO benefits and fast first paint | Use `client:load` or `client:visible` instead |
| Giant monolithic pages | Hard to maintain and test | Split into layouts + reusable components |
| Ignoring `astro add` for integrations | Manual config is error-prone | Use `astro add` for official integrations |
| Missing `alt` on images | Accessibility violation | Always provide descriptive `alt` text |

---
name: seo-patterns
description: "Technical SEO patterns for meta tags, structured data, sitemaps, URL strategy, and rendering. Use when optimizing pages for search engines or implementing SEO features."
---

# SEO Patterns

## Meta Tags & Open Graph
- `<title>`, `<meta name="description">` for every page template
- Open Graph tags (`og:title`, `og:description`, `og:image`, `og:type`)
- Twitter Card tags (`twitter:card`, `twitter:title`, `twitter:image`)
- Canonical URLs (`<link rel="canonical">`)
- Robots directives (`noindex`, `nofollow` where appropriate)

## Structured Data (JSON-LD)
- **LocalBusiness** / **Restaurant** / **CafeOrCoffeeShop** for venue pages
- **BreadcrumbList** for navigation hierarchy
- **WebSite** with **SearchAction** for sitelinks search box
- **ItemList** for venue listing pages
- **Organization** for the site entity
- Validate against schema.org and Google's requirements

## Sitemap & Crawlability
- Dynamic XML sitemap generation for all venue pages
- Sitemap index for large venue counts (705+ and growing)
- `robots.txt` configuration
- Internal linking structure
- Page speed impact on crawl budget

## URL Strategy
- Clean, keyword-relevant slugs for venue pages
- Consistent URL patterns across venue categories
- Redirect handling for renamed/moved venues (301 redirects)
- Trailing slash consistency

## Rendering & Indexability
- Ensure critical content is server-rendered (not client-only)
- Verify pages are indexable with `fetch as Googlebot`
- Check hydration doesn't break structured data
- Image optimization for search (alt text, file names, lazy loading below fold)

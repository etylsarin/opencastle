---
name: contentful-cms
description: "Contentful CMS development patterns, GraphQL/REST API usage, content modeling, and migration best practices. Use when working with Contentful content types, entries, assets, or the Management API."
---

# Contentful CMS

Generic Contentful CMS development methodology. For project-specific configuration, content types, and API keys, see [cms-config.md](../../customizations/stack/cms-config.md).

## Critical Development Rules

1. **Always use Content Types** — define structured content types before creating entries
2. **Prefer GraphQL API** — use the GraphQL Content API for typed, efficient queries
3. **Handle localization** — Contentful fields can be localized; always specify locale in queries
4. **Use environments** — develop in sandbox environments, promote to master via migrations
5. **Migration scripts** — use the Contentful CLI migration tool for schema changes, never modify content types manually in production
6. **Rich Text rendering** — use `@contentful/rich-text-react-renderer` for React apps
7. **Asset handling** — use Contentful's Image API for responsive images with transformations
8. **Webhook-driven** — use webhooks for cache invalidation and rebuild triggers
9. **Rate limiting** — respect API rate limits (Content Delivery: 78 req/s, Management: 10 req/s)
10. **Keep queries in shared library** — queries belong in a shared queries library, never inline in components

## Query Patterns

### GraphQL Content API
- Use typed GraphQL queries with code generation
- Leverage `sys.publishedAt` for cache invalidation
- Use `include` parameter to control link resolution depth
- Filter with `where` clauses for efficient data fetching

### REST Content Delivery API
- Use `content_type` parameter to filter by type
- Use `select` to limit returned fields
- Use `links_to_entry` for reverse lookups
- Handle pagination with `skip` and `limit`

## Content Modeling

- Use **references** for relationships between content types
- Prefer **short text** over **long text** for searchable fields
- Use **JSON fields** sparingly — prefer structured content types
- Design for **reusability** — create component content types for shared UI patterns
- Use **validation rules** on fields to enforce data quality

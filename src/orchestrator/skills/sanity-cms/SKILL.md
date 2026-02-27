---
name: sanity-cms
description: "Sanity CMS development rules, GROQ query patterns, and content management best practices. Use when working with Sanity schemas, writing GROQ queries, modifying content models, or managing CMS configuration."
---

# Sanity CMS

Generic Sanity CMS development methodology. For project-specific configuration, schemas, plugins, document types, and GROQ examples, see [sanity-config.md](../../customizations/stack/sanity-config.md).

## Critical Development Rules

1. **Always check the schema before querying** — use `get_schema` to understand document types and field structures before writing GROQ queries
2. **Array vs single reference** — always verify whether a field is an array of references or a single reference; using the wrong query operator causes silent failures
3. **Local schema files are source of truth** — the Studio schema directory takes precedence over deployed schemas; deploying schemas from a local Studio context creates drift
4. **Follow `defineType` and `defineField` patterns** — always use Sanity helpers for type safety and consistency
5. **Test GROQ queries in Vision** — validate queries against real data in the Vision plugin before deploying
6. **Handle draft/publish workflow** — remember drafts have `drafts.` prefix; mutations create drafts, not published documents
7. **Keep queries in the shared library** — queries belong in a shared queries library, never inline in components

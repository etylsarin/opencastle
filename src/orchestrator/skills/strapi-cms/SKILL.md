---
name: strapi-cms
description: "Strapi CMS development patterns, REST/GraphQL API usage, content type building, plugin development, and deployment best practices. Use when working with Strapi content types, controllers, services, or plugins."
---

# Strapi CMS

Generic Strapi CMS development methodology. For project-specific configuration, content types, and deployment details, see [cms-config.md](../../customizations/stack/cms-config.md).

## Critical Development Rules

1. **Use Content-Type Builder** — define content types through the admin panel or `content-types` directory
2. **REST API by default** — Strapi exposes REST endpoints automatically; enable GraphQL plugin if needed
3. **Customize controllers** — extend auto-generated controllers in `src/api/<type>/controllers/`
4. **Services for business logic** — keep business logic in services, not controllers
5. **Lifecycle hooks** — use model lifecycle hooks for side effects (e.g., `beforeCreate`, `afterUpdate`)
6. **Permissions and roles** — configure permissions via the Users & Permissions plugin
7. **Draft/Publish system** — enable draft/publish on content types that need editorial workflow
8. **Media Library** — use Strapi's media library for asset management; configure providers for S3/Cloudinary
9. **Environment configs** — use `config/env/<env>/` for environment-specific configuration
10. **Never modify `node_modules`** — extend functionality through plugins and customizations

## API Patterns

### REST API
- Endpoints follow `/api/<content-type>` convention
- Use `populate` parameter to include relations
- Use `filters` parameter with operators (`$eq`, `$contains`, `$in`, etc.)
- Pagination via `pagination[page]` and `pagination[pageSize]`
- Use `fields` to select specific attributes

### GraphQL Plugin
- Enable via `@strapi/plugin-graphql`
- Auto-generates types and resolvers from content types
- Use `filters`, `pagination`, and `sort` arguments
- Custom resolvers in `src/api/<type>/graphql/`

## Plugin Development

- Scaffold with `strapi generate plugin <name>`
- Follow the plugin structure: `admin/`, `server/`, `content-types/`
- Register plugin in `config/plugins.ts`
- Use the Plugin SDK for admin panel extensions

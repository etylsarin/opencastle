---
name: convex-database
description: "Convex reactive database patterns, schema design, real-time queries, mutations, actions, and deployment best practices. Use when designing Convex schemas, writing queries/mutations, or managing the Convex backend."
---

# Convex Database

Generic Convex development methodology. For project-specific schema, functions, and deployment details, see [database-config.md](../../customizations/stack/database-config.md).

## Critical Development Rules

1. **Schema-first design** — define schema in `convex/schema.ts` using `defineSchema` and `defineTable`
2. **Queries are reactive** — Convex queries automatically re-run when underlying data changes
3. **Mutations are transactional** — mutations run as ACID transactions; leverage this for consistency
4. **Actions for side effects** — use actions (not mutations) for external API calls, file uploads, etc.
5. **Never await queries in mutations** — queries and mutations run in separate contexts
6. **Use validators** — validate all function arguments with `v` (Convex's validator library)
7. **Index design** — create indexes for frequently filtered/sorted fields in the schema
8. **Paginated queries** — use `.paginate()` for large result sets
9. **File storage** — use Convex's built-in file storage API, not external services
10. **Environment variables** — set via Convex dashboard, access with `process.env` in actions only

## Schema Patterns

### Defining Tables
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
  }).index("by_email", ["email"]),
});
```

### Query Functions
```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { role: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.role) {
      return await ctx.db.query("users").filter(q => q.eq(q.field("role"), args.role)).collect();
    }
    return await ctx.db.query("users").collect();
  },
});
```

### Mutations
```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", { ...args, role: "user" });
  },
});
```

## Real-Time Patterns

- Use `useQuery` hook for automatic real-time subscriptions
- Queries re-run when any referenced table data changes
- Use `useMutation` for optimistic updates
- Paginated queries support real-time updates with `.paginate()`

## Deployment

- Deploy with `npx convex deploy`
- Use `npx convex dev` for local development with hot reload
- Schema changes are automatically migrated
- Use `npx convex import` / `npx convex export` for data management

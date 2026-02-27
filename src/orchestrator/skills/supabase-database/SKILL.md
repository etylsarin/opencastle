---
name: supabase-database
description: "Supabase database migration rules, RLS policy patterns, and auth integration best practices. Use when designing database tables, writing migrations, configuring RLS policies, implementing auth, or managing user roles."
---

# Supabase Database

Generic Supabase development methodology. For project-specific schema, roles, migration history, auth flow, and key files, see [supabase-config.md](../../customizations/stack/supabase-config.md).

## Migration Rules

1. Always write migrations for schema changes — never modify schema directly.
2. Use RLS on all tables — no exceptions.
3. Test RLS from different roles (anon, user, moderator, admin).
4. `CASCADE DELETE` where appropriate.
5. Add indexes for frequently queried columns.
6. Naming: `NNN_description.sql` or `YYYYMMDD_description.sql`.
7. Write idempotent migrations — they must be safe to re-run.
8. Document migration purpose with SQL comments.
9. Validate schema changes don't break existing RLS policies.
10. Use `auth.uid()` in RLS policies — never pass user ID from the client.
11. Prefer database functions for complex authorization logic.
12. Test migrations in a development dataset before production.
13. Always generate TypeScript types after schema changes.

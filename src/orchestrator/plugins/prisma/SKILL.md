---
name: prisma-database
description: "Prisma ORM schema design, migrations, client generation, and query patterns. Use when designing database schemas, writing migrations, querying data, or managing Prisma Client."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Prisma Database

Prisma-specific schema design, migration, and query patterns. For project-specific database schema and connection details, see [database-config.md](../../.opencastle/stack/database-config.md).

## Commands

```bash
npx prisma init                    # Initialize Prisma in the project
npx prisma generate                # Generate Prisma Client from schema
npx prisma migrate dev             # Create and apply migration (dev)
npx prisma migrate deploy          # Apply pending migrations (production)
npx prisma migrate reset           # Reset database and apply all migrations
npx prisma db push                 # Push schema changes without migration
npx prisma db pull                 # Introspect database into schema
npx prisma db seed                 # Run seed script
npx prisma studio                  # Open visual database editor
npx prisma format                  # Format schema file
npx prisma validate                # Validate schema syntax
```

## Schema Design

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@map("users")
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  String

  @@index([authorId])
  @@map("posts")
}
```

### Schema Best Practices

- Use `cuid()` or `uuid()` for IDs — never auto-increment in distributed systems
- Always add `createdAt` and `updatedAt` timestamps
- Use `@map` and `@@map` to control database table/column names
- Add `@@index` for frequently queried columns
- Use `onDelete: Cascade` where appropriate
- Define relations explicitly with `@relation`
- Use enums for constrained string values

## Migration Rules

1. Always use `prisma migrate dev` in development — never `db push` for schema changes that need history
2. Name migrations descriptively: `npx prisma migrate dev --name add_reviews_table`
3. Review generated SQL before applying — Prisma auto-generates but may need manual adjustments
4. Test migrations locally before deploying
5. Use `prisma migrate deploy` in CI/CD — never `migrate dev` in production
6. Write seed scripts for development data in `prisma/seed.ts`
7. Never edit applied migration files — create new migrations instead
8. Run `prisma generate` after every schema change to update the client

## Query Patterns

### Basic CRUD

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Create
const user = await prisma.user.create({
  data: { email: 'user@example.com', name: 'Alice' },
});

// Read (with relations)
const userWithPosts = await prisma.user.findUnique({
  where: { id: userId },
  include: { posts: true },
});

// Update
const updated = await prisma.user.update({
  where: { id: userId },
  data: { name: 'Updated Name' },
});

// Delete
await prisma.user.delete({ where: { id: userId } });
```

### Singleton Pattern

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### Best Practices

- Always use the singleton pattern to avoid connection pool exhaustion
- Use `select` instead of `include` when you only need specific fields
- Use transactions (`prisma.$transaction`) for multi-step operations
- Paginate large result sets with `skip` and `take`
- Handle unique constraint violations with try/catch on `P2002` error code

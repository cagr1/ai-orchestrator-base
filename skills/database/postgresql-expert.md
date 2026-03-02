# PostgreSQL Expert

## Role
Expert in PostgreSQL database design, optimization, and best practices.

## Schema Design Rules
- Always use `UUID` for primary keys (`gen_random_uuid()`) — never auto-increment for distributed systems
- Use `TIMESTAMPTZ` (not `TIMESTAMP`) for all date/time columns
- Add `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ` to every table
- Use `TEXT` instead of `VARCHAR(n)` unless you need a hard limit
- Use `JSONB` (not `JSON`) for semi-structured data — it's indexable
- Soft delete with `deleted_at TIMESTAMPTZ NULL` — never hard delete user data

## Naming Conventions
- Tables: `snake_case`, plural (`users`, `order_items`)
- Columns: `snake_case` (`first_name`, `created_at`)
- Indexes: `idx_{table}_{columns}` (`idx_users_email`)
- Foreign keys: `fk_{table}_{ref_table}` (`fk_orders_user_id`)
- Constraints: `chk_{table}_{column}` (`chk_users_age_positive`)

## Indexing Strategy
- Always index foreign keys
- Composite indexes: most selective column first
- Use `INCLUDE` for covering indexes
- Partial indexes for filtered queries: `WHERE deleted_at IS NULL`
- GIN indexes for JSONB and full-text search
- Never index columns with low cardinality (boolean, status with 3 values)

```sql
-- Good: Partial index for active users
CREATE INDEX idx_users_email_active ON users(email) WHERE deleted_at IS NULL;

-- Good: Composite with INCLUDE
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at) INCLUDE (total);

-- Good: GIN for JSONB
CREATE INDEX idx_products_metadata ON products USING GIN(metadata);
```

## Query Patterns
- Use `EXPLAIN ANALYZE` before optimizing — never guess
- Prefer `EXISTS` over `IN` for subqueries
- Use CTEs (`WITH`) for readability, but know they can be optimization fences
- Batch inserts with `INSERT INTO ... VALUES (...), (...), (...)` — not loops
- Use `RETURNING` clause to avoid extra SELECT after INSERT/UPDATE
- Pagination: Use keyset (`WHERE id > $1 ORDER BY id LIMIT 20`) not `OFFSET`

## Security
- Never store passwords in plain text — use `pgcrypto` with `crypt()` and `gen_salt('bf')`
- Use Row Level Security (RLS) for multi-tenant applications
- Create separate database roles: `app_read`, `app_write`, `app_admin`
- Never use `superuser` role for application connections
- Use `pg_stat_statements` to monitor slow queries

```sql
-- RLS example for multi-tenant
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

## Migrations
- Always use a migration tool (Prisma, Flyway, golang-migrate)
- Never modify existing migrations — create new ones
- Include both `up` and `down` migrations
- Test migrations on a copy of production data
- Use transactions for DDL changes

## Performance
- Connection pooling: Use PgBouncer or Prisma connection pool
- Max connections: `max_connections = 100` is usually enough
- `work_mem`: Increase for complex sorts/joins (4-16MB per connection)
- `shared_buffers`: 25% of available RAM
- Vacuum: Enable `autovacuum` — never disable it
- Use `MATERIALIZED VIEW` for expensive aggregations

## Prisma-Specific
- Use `@map` and `@@map` for snake_case in DB, camelCase in code
- Enable `previewFeatures = ["fullTextSearch"]` for PostgreSQL
- Use `createMany` for batch inserts
- Use `$transaction` for atomic operations
- Connection string: `postgresql://user:pass@host:5432/db?schema=public&connection_limit=5`

## Red Flags
- ❌ Using `SERIAL` instead of `UUID` for new projects
- ❌ No indexes on foreign keys
- ❌ `SELECT *` in production queries
- ❌ N+1 queries (use JOINs or batch loading)
- ❌ Storing files in the database (use object storage + URL reference)
- ❌ No connection pooling
- ❌ `OFFSET` pagination on large tables

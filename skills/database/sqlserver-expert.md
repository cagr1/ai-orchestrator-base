# SQL Server Expert

## Role
Expert in Microsoft SQL Server database design for enterprise applications (.NET, ERP, EF Core).

## Schema Design Rules
- Use `UNIQUEIDENTIFIER` with `NEWSEQUENTIALID()` for PKs in distributed systems
- Use `INT IDENTITY` for PKs in single-server, high-performance scenarios
- Use `NVARCHAR` (not `VARCHAR`) for international text support
- Use `DATETIMEOFFSET` (not `DATETIME`) for timezone-aware timestamps
- Add `CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()` to every table
- Use `BIT` for boolean columns
- Use computed columns for derived values

## Naming Conventions (EF Core / .NET style)
- Tables: `PascalCase`, plural (`Users`, `OrderItems`)
- Columns: `PascalCase` (`FirstName`, `CreatedAt`)
- Indexes: `IX_{Table}_{Columns}` (`IX_Users_Email`)
- Foreign keys: `FK_{Table}_{RefTable}` (`FK_Orders_UserId`)
- Stored procedures: `usp_{Action}{Entity}` (`uspGetUserById`)

## Indexing Strategy
- Clustered index on PK (default with `IDENTITY`)
- Non-clustered on frequently queried columns
- Include columns for covering indexes
- Filtered indexes: `WHERE IsDeleted = 0`
- Columnstore indexes for analytics/reporting tables

```sql
-- Covering index
CREATE NONCLUSTERED INDEX IX_Orders_UserId 
ON Orders(UserId) INCLUDE (Total, CreatedAt);

-- Filtered index
CREATE NONCLUSTERED INDEX IX_Users_Email_Active
ON Users(Email) WHERE IsDeleted = 0;

-- Columnstore for reporting
CREATE NONCLUSTERED COLUMNSTORE INDEX CCI_Sales_Report
ON Sales(ProductId, Quantity, Total, SaleDate);
```

## EF Core Integration
- Use Fluent API over Data Annotations for complex configurations
- Configure in `OnModelCreating` or separate `IEntityTypeConfiguration<T>`
- Use `HasQueryFilter` for global soft-delete filters
- Use `ValueConverter` for enums stored as strings
- Shadow properties for audit fields (`CreatedAt`, `UpdatedAt`)

```csharp
// Soft delete filter
modelBuilder.Entity<User>().HasQueryFilter(u => !u.IsDeleted);

// Audit shadow properties
modelBuilder.Entity<BaseEntity>().Property<DateTimeOffset>("CreatedAt")
    .HasDefaultValueSql("SYSDATETIMEOFFSET()");
```

## Query Patterns
- Use `SET NOCOUNT ON` in stored procedures
- Prefer `EXISTS` over `COUNT(*) > 0`
- Use `MERGE` for upsert operations
- Use `OUTPUT` clause instead of separate SELECT after INSERT
- Use `OFFSET FETCH` for pagination (SQL Server 2012+)
- Use `STRING_AGG` instead of `FOR XML PATH` for string concatenation

## Security
- Use Windows Authentication when possible
- Create application-specific logins with minimal permissions
- Use `EXECUTE AS` for impersonation in stored procedures
- Enable Transparent Data Encryption (TDE) for data at rest
- Use Always Encrypted for sensitive columns (SSN, credit cards)
- Never build SQL strings with concatenation — use parameterized queries

## Performance
- Use Query Store for performance monitoring
- `MAXDOP` setting: Number of CPU cores / 2 (max 8)
- `tempdb`: Multiple data files (1 per CPU core, max 8)
- Statistics: Enable auto-update, consider async update for OLTP
- Use `WITH (NOLOCK)` only for reporting queries — never for transactional
- Index maintenance: Rebuild at >30% fragmentation, reorganize at >10%

## Migrations (EF Core)
- Use `dotnet ef migrations add MigrationName`
- Always review generated SQL before applying
- Use `migrationBuilder.Sql()` for custom SQL in migrations
- Seed data in migrations, not in `OnModelCreating`
- Use `HasData()` only for lookup/reference data

## Red Flags
- ❌ Using `DATETIME` instead of `DATETIMEOFFSET`
- ❌ `SELECT *` in production
- ❌ Cursors for set-based operations
- ❌ `NOLOCK` hints on transactional queries
- ❌ No indexes on foreign keys
- ❌ Storing large BLOBs in the database
- ❌ Dynamic SQL without parameterization
- ❌ Missing clustered index (heap tables)

# SQL Migrations

The base schema lives in `sql/setup.sql`, but long-lived vaults need additive migrations so Supabase and downstream tools stay in sync. Apply each numbered script in this folder **after** running `setup.sql` (or when pulling a new release).

## How to Apply

```bash
psql "$SUPABASE_URL" <<'SQL'
\i sql/setup.sql
\i sql/migrations/001_add_entity_indexes.sql
SQL
```

Each script is idempotent (relies on `IF NOT EXISTS` guards) so it is safe to re-run when provisioning new environments.

## Versioning Conventions

- Use a three-digit prefix (`001`, `002`, …) so migrations stay ordered in Git history.
- Include a short description in the filename (e.g., `002_extend_file_status.sql`).
- Document the intent at the top of the SQL file so operators know why the change exists.

When you add a migration, reference it in release notes and in `INSTALL.md` if manual steps are required.

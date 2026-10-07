# Database

- `migrations/*.sql` are applied in order by `cd backend && npm run db:migrate`. Each file runs once (tracked in `schema_migrations`).
- To change the schema later, add a new file such as `002_add_column.sql`; never edit an applied one.
- Demo data comes from `backend/scripts/seed-demo.js` (all rows flagged `is_demo`, names start with DEMO).

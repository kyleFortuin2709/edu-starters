# Backend inventory for migration to your own Supabase project

Read-only documentation task. No schema, data, policy, bucket, or connection changes — nothing in the current backend is touched.

## What gets produced

A new folder `docs/backend/` containing:

1. `README.md` — overview, recreation order, and a checklist for standing up the new project.
2. `01-schema.sql` — full recreate script: enum types, all 17 public tables with columns/defaults/NOT NULL, primary keys, foreign keys, unique constraints, check constraints, and every index (confirmed from the live catalog).
3. `02-functions-triggers.sql` — `handle_new_user()`, `has_role()`, `set_updated_at()` plus the `on_auth_user_created` trigger on `auth.users` and the 14 `set_updated_at` triggers.
4. `03-grants-rls.sql` — `GRANT`s per table and all 41 RLS policies exactly as they exist today (public catalogue readable by anon/authenticated, user-owned tables scoped to `auth.uid()`, admin tables via `has_role`).
5. `04-storage.sql` — the `prospectuses` bucket (private) and its 4 admin-only `storage.objects` policies.
6. `05-auth-config.md` — auth settings the app depends on, described by name only: email/password enabled, email auto-confirm on, leaked-password protection on, public signup enabled, no social providers, redirect URLs used by password reset. No keys or secrets.
7. `06-edge-functions.md` — records that this project has **no** Supabase Edge Functions; server logic lives in the app as TanStack server functions. Lists the server-side env var *names* the app reads (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`) and the client `VITE_*` names — names only, never values.
8. `07-data-to-preserve.md` — which rows must move for the app to keep working.
9. `migrations/` — a copy of the 13 existing migration files already in `supabase/migrations/`, plus a note that they can be replayed in order as an alternative to `01`–`04`.

## Data that must be preserved

- **Reference/lookup data (required):** `provinces`, `subjects`, `qualification_types` — the app resolves everything from these; UUIDs must be kept because other tables reference them.
- **Catalogue (required to keep matches working):** `aps_calculation_rules`, `aps_point_bands`, `aps_rule_subjects`, `universities`, `faculties`, `courses`, `course_requirement_sets`, `course_requirement_rules`.
- **User data (required, and depends on migrating `auth.users` first):** `profiles`, `student_subjects`, `saved_courses`, `user_roles` — all keyed to auth user IDs, so `auth.users` must be moved before these or the IDs will not resolve. At least one `user_roles` admin row is needed or the admin area locks out.
- **Admin workflow (optional):** `prospectus_documents`, `staged_courses`, and the objects in the `prospectuses` storage bucket. Safe to skip if you don't need past ingestion history; the document rows are meaningless without the matching files.

The doc will include the exact dependency-ordered list for copying rows, and will note that `auth.users` migration (with password hashes) is done through Supabase's own project-migration tooling, not from app code.

## Notes

- Everything is derived from the live catalog plus the repo's migration files; no secret values, keys, passwords, or tokens are written anywhere.
- No application code changes: the app keeps pointing at the current backend until you decide to switch environment variables.

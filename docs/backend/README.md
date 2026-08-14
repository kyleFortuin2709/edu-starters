# EduStarter backend inventory

Read-only documentation of the current backend, produced so it can be recreated
in a Supabase project you own. **Nothing in the live backend was modified** and
**no secret values, API keys, passwords or tokens appear anywhere in this folder.**

Inventoried on 14 Aug 2026.

## Contents

| File | What it covers |
| --- | --- |
| `01-schema.sql` | 6 enum types, 17 tables with all columns/defaults/constraints, and all indexes |
| `02-functions-triggers.sql` | `handle_new_user()`, `has_role()`, `set_updated_at()`, the `auth.users` trigger and 14 `updated_at` triggers |
| `03-grants-rls.sql` | GRANTs plus all 41 RLS policies |
| `04-storage.sql` | The `prospectuses` bucket and its 4 admin-only object policies |
| `05-auth-config.md` | Auth providers, settings and redirect URLs the app depends on |
| `06-edge-functions.md` | No Edge Functions exist; lists required env var **names** |
| `07-data-to-preserve.md` | Which rows must move, in what order, and how to verify |
| `migrations/` | Copies of the 13 migration files in `supabase/migrations/` |

## Two ways to recreate the schema

**A. Consolidated scripts (recommended).** Run against a fresh project in order:

```text
01-schema.sql -> 02-functions-triggers.sql -> 03-grants-rls.sql -> 04-storage.sql
```

These reflect the schema as it exists **today**, after all edits.

**B. Replay the migrations.** Apply `migrations/*.sql` in filename order. Same
end state, but it replays intermediate states. Use this if you want the new
project's migration history to match.

## Checklist for the new project

1. Create the project (region close to your users).
2. Run the four SQL scripts above (or replay the migrations).
3. Create the `prospectuses` Storage bucket as **private**.
4. Apply the auth settings in `05-auth-config.md`, and add your app origins to the Site URL / Redirect URLs allow-list.
5. Migrate `auth.users`, then copy table data in the order in `07-data-to-preserve.md`.
6. Insert an `admin` row into `user_roles` for your own account.
7. Set the environment variables listed in `06-edge-functions.md` to the new project's values.
8. Work through the verification steps at the end of `07-data-to-preserve.md`.

## Known quirks carried over

- `student_subjects` has two identical partial unique indexes (`student_subjects_unique_subject` and `student_subjects_profile_subject_key`). `01-schema.sql` creates only one.
- `student_subjects` has two overlapping `mark` range checks; both are reproduced as one equivalent check.
- `user_roles` is currently empty, so no account holds the admin role.
- `provinces` has no `updated_at` column and therefore no update trigger.

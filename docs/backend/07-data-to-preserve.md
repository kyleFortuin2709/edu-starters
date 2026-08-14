# Data that must be preserved

Row counts observed at the time of this inventory (14 Aug 2026).

## Tier 1 — required, keep the original UUIDs

Everything else references these by id, so re-seeding them with new UUIDs would
break every foreign key and every stored reference.

| Table | Rows | Why |
| --- | --- | --- |
| `provinces` | 9 | Referenced by universities and profiles |
| `subjects` | 28 | Referenced by student results, APS rules and course requirements |
| `qualification_types` | 8 | Referenced by courses |

## Tier 2 — catalogue; required for matches to work

| Table | Rows |
| --- | --- |
| `aps_calculation_rules` | 3 |
| `aps_point_bands` | 23 |
| `aps_rule_subjects` | 1 |
| `universities` | 4 |
| `faculties` | 16 |
| `courses` | 9 |
| `course_requirement_sets` | 10 |
| `course_requirement_rules` | 29 |

Without these the eligibility engine has nothing to evaluate and the results
dashboard shows only empty states.

## Tier 3 — user data; depends on `auth.users` moving first

| Table | Rows | Notes |
| --- | --- | --- |
| `profiles` | 2 | Primary key is the auth user id |
| `student_subjects` | 9 | The students' NSC marks |
| `saved_courses` | 0 | Currently empty |
| `user_roles` | 0 | **Currently empty** — no admin role rows exist. Insert an admin row for your own account in the new project or the admin area is inaccessible |

`auth.users` cannot be copied with SQL from the app. Use Supabase's own project
migration tooling (or the Auth Admin API) to move users with their password
hashes, then copy the tables above. Copy `auth.users` **before** these tables, or
the foreign keys will reject the inserts.

## Tier 4 — admin ingestion history; optional

| Table | Rows | Notes |
| --- | --- | --- |
| `prospectus_documents` | 1 | Rows are useless without the matching Storage object |
| `staged_courses` | 76 | AI-extracted rows awaiting review |
| Storage bucket `prospectuses` | uploaded PDFs | Copy the objects if you keep the two tables above |

Safe to skip entirely if you don't need past ingestion runs; new uploads work
against an empty bucket. Note that `staged_courses.published_course_id` points
at `courses`, so if you keep staged rows, copy them after the catalogue.

## Copy order

```text
auth.users
  -> provinces, subjects, qualification_types
  -> aps_calculation_rules -> aps_point_bands, aps_rule_subjects
  -> universities -> faculties -> courses
  -> course_requirement_sets -> course_requirement_rules
  -> profiles -> student_subjects, saved_courses
  -> user_roles
  -> prospectus_documents -> staged_courses   (optional)
  -> storage objects in "prospectuses"        (optional)
```

## Verification after the move

1. `provinces`, `subjects`, `qualification_types` counts match.
2. Sign in as a student → dashboard shows the same subject count and per-institution APS scores.
3. `/matches` returns the same courses in the same eligibility tabs.
4. An account with an `admin` row in `user_roles` can open `/admin`.
5. Uploading a PDF creates an object in the `prospectuses` bucket and a `prospectus_documents` row.

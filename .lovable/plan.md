# Move EduStarter fully onto your own Supabase project

Right now the app is split across two backends: the browser talks to your own project (`gvstay…`) because it is hard-pinned in the build config, while everything server-side (admin actions, auth verification on server functions, storage/prospectus operations) still talks to the Lovable-managed project (`cuxhos…`). That mismatch means server-side token checks and admin writes are happening against the wrong database.

This plan removes the Lovable-managed backend from every code path.

## What changes for you

- One backend: your own Supabase project, for auth, database, storage and admin operations.
- The AI Course Advisor stops using Lovable's AI gateway and instead calls an AI endpoint on your own Supabase project (same pattern as the prospectus extractor). If that endpoint is not deployed yet, the advisor shows a friendly "advisor unavailable" message instead of breaking the page.
- You will need to add three secrets (your project URL, publishable key, service-role key). The service-role key is required for admin publishing and prospectus storage operations.
- I will hand you a single consolidated SQL script plus storage-bucket setup so your project has the exact schema, RLS, roles and demo data the app expects.

## Technical plan

**1. New connection layer (own, not Lovable-managed)**

The generated files under `src/integrations/supabase/` are auto-managed and read Lovable Cloud's reserved `SUPABASE_*` env vars, so the app stops depending on them.

- Add `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (publishable, server), `src/lib/supabase/admin.server.ts` (service role), and `src/lib/supabase/auth.middleware.ts` (bearer verification against your project).
- Values come from non-reserved secrets: `EDUSTARTER_SUPABASE_URL`, `EDUSTARTER_SUPABASE_PUBLISHABLE_KEY`, `EDUSTARTER_SUPABASE_SERVICE_ROLE_KEY`. Server code reads them inside handlers only.
- Keep `src/integrations/supabase/types.ts` for typing (types only, no connection).

**2. Repoint every consumer**

Replace imports of `@/integrations/supabase/client`, `client.server`, `auth-middleware` across `src/lib/*` (`profile.ts`, `results.ts`, `catalogue.ts`, `aps.ts`, `eligibility.ts`, `saved-courses-context.tsx`, `prospectus.ts`, `supabase-admin.server.ts`, `supabase-env.ts`, `supabase-auth.middleware.ts`, `prospectus-extract.functions.ts`), `src/lib/auth.tsx`, `src/start.ts` bearer attacher, and the `_authenticated` route gate.

**3. Build config**

Replace the hard-coded `define` block in `vite.config.ts` with values sourced from the new secrets, so the browser bundle no longer carries a pasted URL/key and no Lovable-injected `VITE_SUPABASE_*` can win.

**4. AI advisor off Lovable AI**

Rewrite `src/lib/course-advisor.functions.ts` to POST to `${EDUSTARTER_SUPABASE_URL}/functions/v1/course-advisor` with the caller's bearer token, dropping `LOVABLE_API_KEY`. Same request/response contract, so `CourseAdvisor.tsx` is unchanged apart from error copy.

**5. Schema handoff**

Generate `docs/backend/external-supabase-setup.sql`: all enums, tables, GRANTs, RLS policies, `has_role`/`handle_new_user`/`set_updated_at` functions and triggers, the `prospectuses` private bucket + storage policies, and the demo seed rows — idempotent so it is safe to run on a partially-set-up project.

**6. Verification**

Sign up, log in, profile setup, results entry and persistence, matches/eligibility, saved courses, admin role gate, prospectus upload — checked against your project, with a check that no request goes to `cuxhos…`.

## Notes

- Disconnecting Lovable Cloud in project settings is a separate, irreversible admin action; this plan only removes the code's dependence on it. Do that after the app is verified working.
- The prospectus `extract-prospectus` edge function on your project stays as-is.

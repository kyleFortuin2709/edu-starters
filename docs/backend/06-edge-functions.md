# Edge Functions and environment variables

## Edge Functions: none

This project has **no Supabase Edge Functions**. There is no `supabase/functions/`
directory and no deployed function. All server-side logic runs inside the
application itself (TanStack Start server functions, executed by the app's own
hosting runtime), so nothing needs to be deployed to the new Supabase project's
Functions section.

Server-side modules in the app, for reference:

| File | Purpose |
| --- | --- |
| `src/lib/course-advisor.functions.ts` | AI course advisor; calls the Lovable AI gateway |
| `src/lib/prospectus-extract.functions.ts` | Entry point for prospectus AI extraction |
| `src/lib/prospectus-extract.run.server.ts` | Downloads the PDF from Storage, writes staged rows |
| `src/lib/prospectus-extract.server.ts` | Model call + strict JSON parsing |
| `src/integrations/supabase/auth-middleware.ts` | Validates the bearer token per request |
| `src/integrations/supabase/client.server.ts` | Service-role client (server only) |

## Environment variable names

Names only. **No values appear in this repository documentation.**

### Server-side (never exposed to the browser)

| Name | Used for |
| --- | --- |
| `SUPABASE_URL` | Project API URL for server-side clients |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key used by the auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged client: Storage download, staged-course inserts |
| `SUPABASE_PROJECT_ID` | Project reference |
| `LOVABLE_API_KEY` | AI gateway calls (advisor + prospectus extraction) — not a Supabase value |

### Client-side (safe to ship in the bundle)

| Name | Used for |
| --- | --- |
| `VITE_SUPABASE_URL` | Browser Supabase client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser Supabase client |
| `VITE_SUPABASE_PROJECT_ID` | Project reference |

### Switching to the new project

Repoint these names at the new project's URL and keys. `src/integrations/supabase/client.ts`,
`client.server.ts` and `auth-middleware.ts` read them by name and need no code change.
If the new project issues new-format `sb_publishable_*` / `sb_secret_*` keys, keep using
them as `apikey` — do not hand-roll a JWT-style client.

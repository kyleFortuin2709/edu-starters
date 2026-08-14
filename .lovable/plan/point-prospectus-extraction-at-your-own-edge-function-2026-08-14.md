# Point prospectus extraction at your own edge function

Prospectus analysis moves out of this project entirely. Instead of calling the Lovable AI gateway and staging the results here, the admin "Run extraction" button will call your `extract-prospectus` edge function, which does the whole job (reads the document, calls your AI API, writes staged courses, updates document status). The app then just refreshes and shows what your function produced.

## What changes for you

- Nothing visible in the admin UI: same button, same progress state, same "N courses staged for review" message, same error handling.
- No Lovable AI usage for prospectuses. The course advisor is untouched.
- If your function is slow or errors, the admin sees a clear message and the document status refreshes from the database.

## Technical detail

**Call path**

`extractProspectus` (server function, `src/lib/prospectus-extract.functions.ts`) keeps its current signature and auth:
- still `.middleware([requireSupabaseAuth])`, still takes `{ prospectusId }`
- still verifies the caller has the `admin` role via `has_role` before doing anything
- then POSTs to `${SUPABASE_URL}/functions/v1/extract-prospectus` with body `{ prospectusId }`, forwarding the caller's bearer token plus the `apikey` header so your function can authorise the request itself
- returns the function's JSON to the UI as `{ stagedCount, documentFlags, apsMethodologyFound }`

**Expected response** (same shape as today, so no UI change):

```text
{ "stagedCount": number, "documentFlags": string[], "apsMethodologyFound": boolean }
```

Non-2xx responses are surfaced with the function's message when it returns `{ error: "..." }`, otherwise a generic "We couldn't analyse that document" message. A short timeout guard is added so the admin isn't left hanging indefinitely.

**Removed**

- `src/lib/prospectus-extract.server.ts` (Lovable AI gateway call, prompt, JSON normaliser)
- `src/lib/prospectus-extract.run.server.ts` (PDF download + staged-row writes) — this work now lives in your edge function
- `LOVABLE_API_KEY` is no longer read on the prospectus path

**Kept**

- The staging tables, review/approve/publish workflow, and `prospectus-publish.ts` are unchanged — they read whatever rows your function writes.
- `src/lib/supabase-env.ts` and the admin client stay, since other admin paths use them.
- The `EXTRACTION_MODEL` label shown in the UI comes from the row your function writes (`prospectus_documents.extraction_model`) rather than a constant in this project.

**Your side (not code I write here)**

Your `extract-prospectus` function must insert into `staged_courses` with `status = 'review_required'` and update `prospectus_documents` (`status`, `extracted_at`, `extraction_model`, `aps_methodology_text`, `extraction_payload`, `error_message`) using the same field names the review UI already reads.

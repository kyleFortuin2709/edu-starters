# Edge functions to deploy in your own Supabase project

These are written for your project (the one the app points at), not for the
Lovable-managed one — deploy them yourself with the Supabase CLI or dashboard:

```
supabase functions deploy course-ai
supabase functions deploy course-chat
supabase functions deploy course-interests
supabase secrets set GEMINI_API_KEY=...
```

Copy each folder into `supabase/functions/<name>/index.ts` in your own repo.

The app calls them through authenticated server functions, forwarding the
signed-in user's bearer token, so keep `verify_jwt` on (the default).

| Function | Called from | Body in | Body out |
| --- | --- | --- | --- |
| `course-ai` | `src/lib/course-overview.functions.ts` | `course_id, course_name, qualification_name, faculty_name, description` | `{ summary, careers: [{title, description}] }` |
| `course-chat` | `src/lib/course-advisor.functions.ts` | `question, context, history[]` | `{ answer }` |
| `course-interests` | `src/lib/course-riasec.functions.ts` | `courses: [{course_id, name, qualification, faculty, description}]` | `{ courses: [{course_id, realistic…conventional, notes}] }` |

`course-ai` caches into `public.course_ai_overviews` and only calls Gemini when
there is no row for that course.

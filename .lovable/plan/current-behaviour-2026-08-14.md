Fix the matric document polling flow so the UI treats the Edge Function's `pending` status as an in-progress state rather than a completion signal.

## Current behaviour
- `src/lib/matric-extract.ts` only knows document statuses `processing`, `review_required`, and `failed`.
- `src/components/ResultsDocumentUpload.tsx` keeps polling while the status is `processing`, and treats any other status as finished.
- The user's external Edge Function writes `pending` as the initial status, so the UI currently exits the polling loop before any rows are written and shows an empty "done" state.

## Change
1. Expand `DocumentStatus` in `src/lib/matric-extract.ts` to include `pending`.
2. In `src/components/ResultsDocumentUpload.tsx`, keep polling while the status is `pending` or `processing`.
3. Continue the existing rule that extracted subjects move the UI to "done" immediately, regardless of document status.
4. Finalise to "done" on `review_required` (or any non-processing, non-pending status) when no subjects are found.

## Result
A student who uploads a certificate will see the progress panel continue reading until staged subjects appear, then the extracted results table and success message appear immediately. If the worker finishes without finding subjects, the UI will still show the empty-state message instead of hanging forever.

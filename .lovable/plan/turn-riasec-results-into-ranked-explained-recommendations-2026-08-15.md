# Turn RIASEC results into ranked, explained recommendations

## What I checked

- Your RIASEC profile is saved and readable: Artistic 20%, Enterprising 20%, Realistic/Investigative/Social/Conventional 15% each, 20 questions answered.
- The backend function `get_course_recommendations` works and returns rows.
- Every course currently comes back as `recommendation_available: false` with reason `course_profile_unavailable`, because the backend table that stores each course's interest profile (`course_riasec_profiles`) is **empty**. That is the only thing blocking recommendations today.

## The plan

### 1. Generate course interest profiles with AI (admin tool)

A new admin screen, "Course interest profiles", under the admin area:

- Lists courses and shows which ones already have an interest profile.
- "Generate profiles" button runs an AI pass over the selected/missing courses using the course name, faculty, qualification type and description.
- The AI returns six RIASEC scores per course (0-100, roughly summing to 100) plus a one-line rationale, saved into `course_riasec_profiles` (`realistic_score`, `investigative_score`, `artistic_score`, `social_score`, `enterprising_score`, `conventional_score`, `notes`).
- Admin can review and edit any score before/after saving; nothing is auto-published without appearing in the table.
- Batched (e.g. 20 courses per call) with progress feedback, so large catalogues finish reliably.

### 2. Ordering (already wired, activates once profiles exist)

No change to eligibility, APS, or requirements. Within each existing tab (You qualify / Almost / Don't qualify), courses are sorted by `recommendation_score` descending. Courses without a score sink to the bottom of their own group.

### 3. Highlighting on the matches list

Each course card gains:

- A match badge — "Strong match" / "Good match" / "Moderate match" / "Low match" — colour-tinted (green / teal / amber / neutral) instead of today's plain grey pill.
- A short reason line under the badge, generated on the client from the overlap between your top interest dimensions and the course's top dimensions, e.g. "Fits your Artistic and Enterprising interests".
- The top-scoring card in the "You qualify" tab gets a subtle "Top recommendation" accent ring.

The reason text is presentation only — it describes the backend's score, it does not recalculate it.

### 4. Fallbacks

- If no course profiles exist yet, or the questionnaire isn't done, matches behave exactly as they do now, with the existing "Find My Best Matches" CTA.
- Recommendations still load after eligibility and never block it.

## Technical notes

- New server function `src/lib/course-riasec.functions.ts` calling the Lovable AI gateway with a strict JSON schema; writes via the service-role client, admin-verified in the handler.
- New admin route `src/routes/_authenticated/admin/interest-profiles.tsx`.
- `src/lib/recommendations.ts`: add a tone map and a `recommendationReason(studentProfile, courseProfile)` helper; fetch course profiles alongside recommendations for the reason text.
- `src/components/EligibilityCourseCard.tsx`: coloured badge, reason line, optional top-pick ring.
- `src/routes/_authenticated/matches/index.tsx`: pass the student's RIASEC profile and course profiles down; mark the top card.
- No schema migration needed — the table and RPC already exist.

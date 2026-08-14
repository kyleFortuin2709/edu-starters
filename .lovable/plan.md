Remove the "Results status" card from the student dashboard and adjust the grid layout.

## What to change

- In `src/routes/_authenticated/dashboard.tsx`, delete the second dashboard card (lines 91–107) that shows the "Results status" indicator, "Results saved / Not started" text, and the explanatory sentence.
- Change the parent grid from `md:grid-cols-3` to `md:grid-cols-2` so the remaining "Subjects entered" and "Next step" cards sit side by side on desktop.

## What to keep

- Keep the `subjectCount` state and `countMyResults` call; they still drive the "Subjects entered" count, the primary CTA, and the "Next step" links.
- Keep the rest of the dashboard layout (header, APS/tolerance cards below, etc.) unchanged.

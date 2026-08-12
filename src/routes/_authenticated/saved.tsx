import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ActionButton } from "@/components/ActionButton";
import { EligibilityCourseCard } from "@/components/EligibilityCourseCard";
import { useAuth } from "@/lib/auth";
import { useSavedCourses } from "@/lib/saved-courses-context";
import { loadEligibilityView, type CourseEligibilityView } from "@/lib/eligibility-view";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({
    meta: [
      { title: "Saved courses — EduStarter" },
      {
        name: "description",
        content: "The courses you've saved while exploring your NSC results on EduStarter.",
      },
      { property: "og:title", content: "Saved courses — EduStarter" },
      {
        property: "og:description",
        content: "Your shortlist of saved university courses in EduStarter.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SavedCoursesPage,
});

function SavedCoursesPage() {
  const { user } = useAuth();
  const { savedIds } = useSavedCourses();
  const [courses, setCourses] = useState<CourseEligibilityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadEligibilityView(user.id)
      .then((view) => {
        if (!active) return;
        setCourses(view.courses);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't load your saved courses right now. Please refresh the page.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const saved = useMemo(
    () => courses.filter((c) => savedIds.has(c.courseId)),
    [courses, savedIds],
  );

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Your shortlist
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Saved courses</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Courses you've saved while exploring your matches. Saving a course doesn't apply for you —
          it just keeps it handy.
        </p>

        {loading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading your saved courses…</p>
        ) : error ? (
          <p className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {error}
          </p>
        ) : saved.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {saved.map((course) => (
              <EligibilityCourseCard key={course.courseId} course={course} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-[2rem] border border-dashed border-border bg-card p-10 text-center">
            <h2 className="font-display text-2xl font-semibold">Nothing saved yet</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Tap the bookmark on any course card or course page and it will appear here, on every
              device you sign in on.
            </p>
            <Link to="/matches" className="mt-6 inline-block">
              <ActionButton size="lg">Browse my matches</ActionButton>
            </Link>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

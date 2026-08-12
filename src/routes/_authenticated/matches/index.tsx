import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ActionButton } from "@/components/ActionButton";
import { SelectField } from "@/components/SelectField";
import { EligibilityCourseCard } from "@/components/EligibilityCourseCard";
import { useAuth } from "@/lib/auth";
import type { EligibilityStatus } from "@/lib/eligibility";
import {
  applyFilters,
  EMPTY_FILTERS,
  filterOptions,
  loadEligibilityView,
  type CourseEligibilityView,
  type EligibilityFilters,
} from "@/lib/eligibility-view";

export const Route = createFileRoute("/_authenticated/matches/")({
  head: () => ({
    meta: [
      { title: "Your course matches — EduStarter" },
      {
        name: "description",
        content:
          "See which demo courses you qualify for, almost qualify for, or don't yet meet, based on your NSC results.",
      },
      { property: "og:title", content: "Your course matches — EduStarter" },
      {
        property: "og:description",
        content: "Compare your NSC results with course entry requirements in EduStarter.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MatchesPage,
});

const TABS: { status: EligibilityStatus; label: string }[] = [
  { status: "YOU_QUALIFY", label: "You qualify" },
  { status: "ALMOST_QUALIFY", label: "Almost qualify" },
  { status: "DONT_QUALIFY", label: "Don't qualify" },
];

const EMPTY_COPY: Record<EligibilityStatus, { title: string; body: string }> = {
  YOU_QUALIFY: {
    title: "No courses meet all the requirements yet",
    body: "Check the Almost qualify tab to see which requirements you are closest to, or update your results if something is missing.",
  },
  ALMOST_QUALIFY: {
    title: "Nothing is in the almost-qualify range",
    body: "Courses appear here when you fall short of a requirement by no more than your tolerance settings, which you can change on your dashboard.",
  },
  DONT_QUALIFY: {
    title: "No courses fall outside your reach",
    body: "Every evaluated course is either a match or close to one.",
  },
  MORE_INFORMATION_REQUIRED: {
    title: "Nothing needs more information",
    body: "Every evaluated course could be compared with your results.",
  },
};

function MatchesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseEligibilityView[]>([]);
  const [hasResults, setHasResults] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<EligibilityStatus>("YOU_QUALIFY");
  const [filters, setFilters] = useState<EligibilityFilters>(EMPTY_FILTERS);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadEligibilityView(user.id)
      .then((view) => {
        if (!active) return;
        setCourses(view.courses);
        setHasResults(view.hasResults);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't work out your matches right now. Please refresh the page.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const options = useMemo(() => filterOptions(courses), [courses]);
  const filtered = useMemo(() => applyFilters(courses, filters), [courses, filters]);
  const byStatus = useMemo(
    () => filtered.filter((c) => c.status === tab),
    [filtered, tab],
  );
  const needsInfo = useMemo(
    () => filtered.filter((c) => c.status === "MORE_INFORMATION_REQUIRED"),
    [filtered],
  );
  const countFor = (status: EligibilityStatus) =>
    filtered.filter((c) => c.status === status).length;

  const setFilter = (key: keyof EligibilityFilters) => (value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-7xl px-6 py-24 text-sm text-muted-foreground">
          Working out your matches…
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Course matches · Demo data
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              Where you may qualify
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Your NSC results are compared with each course's published entry requirements. Meeting
              the requirements is never a guarantee of admission.
            </p>
          </div>
          <Link to="/results">
            <ActionButton variant="outline" size="lg">
              Edit my results
            </ActionButton>
          </Link>
        </div>

        {error ? (
          <p className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {error}
          </p>
        ) : !hasResults ? (
          <div className="mt-10 rounded-[2rem] border border-dashed border-border bg-card p-10 text-center">
            <h2 className="font-display text-2xl font-semibold">No results captured yet</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Add your NSC subjects and marks first. As soon as they are saved, every course is
              evaluated against your results automatically.
            </p>
            <Link to="/results" className="mt-6 inline-block">
              <ActionButton size="lg">Add my results</ActionButton>
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-4 rounded-[2rem] border border-border bg-card p-6 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                id="filter-province"
                label="Province"
                placeholder="All provinces"
                value={filters.province}
                onChange={(e) => setFilter("province")(e.target.value)}
                options={options.provinces.map((v) => ({ value: v, label: v }))}
              />
              <SelectField
                id="filter-university"
                label="University"
                placeholder="All universities"
                value={filters.university}
                onChange={(e) => setFilter("university")(e.target.value)}
                options={options.universities.map((v) => ({ value: v, label: v }))}
              />
              <SelectField
                id="filter-faculty"
                label="Faculty"
                placeholder="All faculties"
                value={filters.faculty}
                onChange={(e) => setFilter("faculty")(e.target.value)}
                options={options.faculties.map((v) => ({ value: v, label: v }))}
              />
              <SelectField
                id="filter-qualification"
                label="Qualification type"
                placeholder="All qualification types"
                value={filters.qualification}
                onChange={(e) => setFilter("qualification")(e.target.value)}
                options={options.qualifications.map((v) => ({ value: v, label: v }))}
              />
            </div>

            <div
              role="tablist"
              aria-label="Eligibility status"
              className="mt-10 flex flex-wrap gap-2"
            >
              {TABS.map(({ status, label }) => (
                <button
                  key={status}
                  role="tab"
                  aria-selected={tab === status}
                  onClick={() => setTab(status)}
                  className={`rounded-full border px-5 py-2.5 font-mono text-xs font-bold uppercase transition-all ${
                    tab === status
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label} ({countFor(status)})
                </button>
              ))}
            </div>

            {byStatus.length > 0 ? (
              <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {byStatus.map((course) => (
                  <EligibilityCourseCard key={course.courseId} course={course} />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-[2rem] border border-dashed border-border bg-card p-10 text-center">
                <h2 className="font-display text-2xl font-semibold">{EMPTY_COPY[tab].title}</h2>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                  {EMPTY_COPY[tab].body}
                </p>
              </div>
            )}

            {needsInfo.length > 0 && (
              <div className="mt-12">
                <h2 className="font-display text-2xl font-semibold">More information required</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  These courses ask for something we can't check yet — usually a subject you haven't
                  captured, or a course with no published requirements.
                </p>
                <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {needsInfo.map((course) => (
                    <EligibilityCourseCard key={course.courseId} course={course} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </SiteLayout>
  );
}
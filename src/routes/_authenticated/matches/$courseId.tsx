import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ActionButton } from "@/components/ActionButton";
import { EligibilityStatusBadge } from "@/components/EligibilityStatusBadge";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { fetchCourseWithRequirements, type CourseWithRequirements } from "@/lib/catalogue";
import type { RequirementCheck } from "@/lib/eligibility";
import { describeCheck, STATUS_LABEL, STATUS_TONE } from "@/lib/eligibility-format";
import { loadEligibilityView, type CourseEligibilityView } from "@/lib/eligibility-view";

export const Route = createFileRoute("/_authenticated/matches/$courseId")({
  head: () => ({
    meta: [
      { title: "Course details — EduStarter" },
      {
        name: "description",
        content: "See how your NSC results compare with this course's entry requirements.",
      },
      { property: "og:title", content: "Course details — EduStarter" },
      {
        property: "og:description",
        content: "Your results compared with course entry requirements in EduStarter.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CourseDetailPage,
});

const OUTCOME_LABEL: Record<RequirementCheck["outcome"], string> = {
  met: "Met",
  almost: "Close",
  not_met: "Not met",
  unknown: "Unknown",
};

const OUTCOME_TONE: Record<RequirementCheck["outcome"], string> = {
  met: "text-success",
  almost: "text-warning",
  not_met: "text-muted-foreground",
  unknown: "text-primary",
};

function CourseDetailPage() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState<CourseEligibilityView | null>(null);
  const [course, setCourse] = useState<CourseWithRequirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([loadEligibilityView(user.id), fetchCourseWithRequirements(courseId)])
      .then(([view, record]) => {
        if (!active) return;
        setEligibility(view.courses.find((c) => c.courseId === courseId) ?? null);
        setCourse(record);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't load this course right now. Please refresh the page.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, courseId]);

  if (loading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-5xl px-6 py-24 text-sm text-muted-foreground">Loading…</div>
      </SiteLayout>
    );
  }

  if (error || !eligibility) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h1 className="font-display text-3xl font-semibold">Course not available</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {error || "We couldn't find this course among your evaluated matches."}
          </p>
          <Link to="/matches" className="mt-6 inline-block">
            <ActionButton variant="outline">Back to my matches</ActionButton>
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const tone = STATUS_TONE[eligibility.status];
  const checks = eligibility.bestSet?.checks ?? [];
  const results = eligibility.apsCalculation?.subjects ?? [];

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-6 py-16">
        <Link
          to="/matches"
          className="font-mono text-xs uppercase text-muted-foreground hover:text-foreground"
        >
          ← Back to my matches
        </Link>

        <header className={cn("mt-6 rounded-[2rem] border bg-card p-8", tone.border)}>
          <EligibilityStatusBadge status={eligibility.status} />
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">
            {eligibility.courseName}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {[
              eligibility.universityName,
              eligibility.facultyName,
              eligibility.provinceName,
              eligibility.qualificationName,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {course?.description ? (
            <p className="mt-5 max-w-2xl text-sm text-muted-foreground">{course.description}</p>
          ) : null}
          {eligibility.isDemoCourse ? (
            <p className="mt-5 inline-block rounded-full border border-border px-3 py-1 font-mono text-[0.65rem] uppercase text-muted-foreground">
              Demo course data
            </p>
          ) : null}
        </header>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-[2rem] border border-border bg-card p-8">
            <span className="font-mono text-xs uppercase text-muted-foreground">Your APS</span>
            <p className="mt-4 font-display text-4xl font-semibold">
              {eligibility.studentAps ?? "—"}
            </p>
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-8">
            <span className="font-mono text-xs uppercase text-muted-foreground">Required APS</span>
            <p className="mt-4 font-display text-4xl font-semibold">
              {eligibility.requiredAps ?? "—"}
            </p>
            {eligibility.apsGap != null ? (
              <p className={cn("mt-2 text-sm", tone.text)}>
                Short by {eligibility.apsGap} APS points
              </p>
            ) : null}
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-8">
            <span className="font-mono text-xs uppercase text-muted-foreground">
              APS calculation used
            </span>
            <p className="mt-4 text-sm font-semibold">
              {eligibility.apsCalculation?.ruleName ?? "No rule linked"}
            </p>
            <p className="mt-1 font-mono text-xs uppercase text-muted-foreground">
              {eligibility.apsCalculation
                ? `${eligibility.apsCalculation.ruleVersion} · ${eligibility.apsCalculation.ruleStatus}`
                : "APS was not compared"}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[2rem] border border-border bg-card p-8">
          <h2 className="font-display text-2xl font-semibold">Requirements</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {eligibility.bestSet
              ? `Evaluated against "${eligibility.bestSet.setName}".`
              : "This course has no published entry requirements yet."}
          </p>
          {checks.length > 0 ? (
            <ul className="mt-6 divide-y divide-border">
              {checks.map((check) => (
                <li
                  key={check.ruleId}
                  className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold">{check.description}</p>
                    <p className="text-xs text-muted-foreground">{describeCheck(check)}</p>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-xs">
                    <span className="text-muted-foreground">
                      {check.actual ?? "—"} / {check.required ?? "—"}
                    </span>
                    <span className={cn("font-bold uppercase", OUTCOME_TONE[check.outcome])}>
                      {OUTCOME_LABEL[check.outcome]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-6 rounded-[2rem] border border-border bg-card p-8">
          <h2 className="font-display text-2xl font-semibold">Your results</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            How each of your subjects was treated by this institution's APS rule.
          </p>
          {results.length > 0 ? (
            <ul className="mt-6 divide-y divide-border">
              {results.map((subject) => (
                <li
                  key={subject.subjectId}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span className="font-semibold">{subject.subjectName ?? "Subject"}</span>
                  <span className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
                    <span>{subject.mark}%</span>
                    <span>{subject.counted ? `${subject.points} pts` : subject.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6">
              <p className="text-sm text-muted-foreground">No results to compare yet.</p>
              <Link to="/results" className="mt-4 inline-block">
                <ActionButton variant="outline">Add my results</ActionButton>
              </Link>
            </div>
          )}
        </div>

        {eligibility.notes.length > 0 && (
          <ul className="mt-6 space-y-2 text-xs text-muted-foreground">
            {eligibility.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        )}

        {/* Reserved for future AI explanations / chat. Not implemented yet. */}
        <div className="mt-6 rounded-[2rem] border border-dashed border-border bg-card/60 p-8">
          <span className="font-mono text-xs uppercase text-muted-foreground">Coming later</span>
          <h2 className="mt-3 font-display text-xl font-semibold">Ask about this course</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            A guided explanation of this result, and answers to your questions about the course, will
            live here in a future update.
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
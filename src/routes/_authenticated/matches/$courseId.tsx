import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ActionButton } from "@/components/ActionButton";
import { EligibilityStatusBadge } from "@/components/EligibilityStatusBadge";
import { SaveCourseButton } from "@/components/SaveCourseButton";
import { CourseAdvisor } from "@/components/CourseAdvisor";
import { CourseOverview } from "@/components/CourseOverview";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { fetchCourseWithRequirements, type CourseWithRequirements } from "@/lib/catalogue";
import type { RequirementCheck } from "@/lib/eligibility";
import { describeCheck, outstandingChecks, STATUS_TONE } from "@/lib/eligibility-format";
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
  const [resultsOpen, setResultsOpen] = useState(true);

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
  const unmet = outstandingChecks(eligibility);
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <EligibilityStatusBadge status={eligibility.status} />
            <SaveCourseButton courseId={eligibility.courseId} showLabel />
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">
            {eligibility.courseName}
          </h1>
          <dl className="mt-6 grid gap-4 font-mono text-xs sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "University", value: eligibility.universityName },
              { label: "Faculty", value: eligibility.facultyName },
              { label: "Province", value: eligibility.provinceName },
              { label: "Qualification", value: eligibility.qualificationName },
            ].map((item) => (
              <div key={item.label}>
                <dt className="uppercase text-muted-foreground">{item.label}</dt>
                <dd className="mt-1 font-sans text-sm font-semibold">{item.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {course?.description ? (
            <p className="mt-5 max-w-2xl text-sm text-muted-foreground">{course.description}</p>
          ) : null}
        </header>

        <CourseOverview
          courseName={eligibility.courseName}
          qualificationName={eligibility.qualificationName ?? null}
          facultyName={eligibility.facultyName ?? null}
          description={course?.description ?? null}
        />

        {unmet.length > 0 && (
          <div className={cn("mt-6 rounded-[2rem] border bg-card p-8", tone.border)}>
            <h2 className="font-display text-2xl font-semibold">What's standing in the way</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {unmet.map((check) => (
                <li key={check.ruleId} className={cn(OUTCOME_TONE[check.outcome])}>
                  • {describeCheck(check)}
                </li>
              ))}
            </ul>
          </div>
        )}

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

        {(eligibility.status === "ALMOST_QUALIFY" ||
          eligibility.status === "DONT_QUALIFY") && (
          <Collapsible open={resultsOpen} onOpenChange={setResultsOpen}>
            <div className="mt-6 rounded-[2rem] border border-border bg-card p-8">
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between text-left">
                  <div>
                    <h2 className="font-display text-2xl font-semibold">Your results</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      How each of your subjects was treated by this institution's APS rule.
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
                      resultsOpen && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {results.length > 0 ? (
                  <ul className="mt-6 space-y-2">
                    {results.map((subject) => {
                      const hasFeedback = !subject.counted && subject.reason;
                      return (
                        <li
                          key={subject.subjectId}
                          className={cn(
                            "flex items-center justify-between gap-4 rounded-2xl px-4 py-3 text-sm",
                            subject.counted && "bg-success/10 text-success",
                            hasFeedback && "bg-warning/10 text-warning",
                          )}
                        >
                          <span className="font-semibold">{subject.subjectName ?? "Subject"}</span>
                          <span className="flex items-center gap-4 font-mono text-xs">
                            <span className={cn(subject.counted ? "text-success" : "text-warning")}>
                              {subject.mark}%
                            </span>
                            <span className={cn("font-semibold", subject.counted ? "text-success" : "text-warning")}>
                              {subject.counted ? `${subject.points} pts` : subject.reason}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="mt-6">
                    <p className="text-sm text-muted-foreground">No results to compare yet.</p>
                    <Link to="/results" className="mt-4 inline-block">
                      <ActionButton variant="outline">Add my results</ActionButton>
                    </Link>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {eligibility.notes.length > 0 && (
          <ul className="mt-6 space-y-2 text-xs text-muted-foreground">
            {eligibility.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        )}

        <CourseAdvisor course={eligibility} description={course?.description ?? null} />
      </section>
    </SiteLayout>
  );
}
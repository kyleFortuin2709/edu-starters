import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { EligibilityStatusBadge } from "@/components/EligibilityStatusBadge";
import { SaveCourseButton } from "@/components/SaveCourseButton";
import { STATUS_TONE, summarizeGap } from "@/lib/eligibility-format";
import type { CourseEligibilityView } from "@/lib/eligibility-view";
import {
  recommendationLabel,
  recommendationScoreText,
  type CourseRecommendation,
} from "@/lib/recommendations";

export function EligibilityCourseCard({
  course,
  recommendation,
  className,
}: {
  course: CourseEligibilityView;
  recommendation?: CourseRecommendation | undefined;
  className?: string;
}) {
  const tone = STATUS_TONE[course.status];
  const gap = summarizeGap(course);
  const matchLabel = recommendation ? recommendationLabel(recommendation) : null;
  const matchScore = recommendation ? recommendationScoreText(recommendation) : null;

  return (
    <Link
      to="/matches/$courseId"
      params={{ courseId: course.courseId }}
      className={cn(
        "group relative block rounded-[2rem] border bg-card p-8 transition-all hover:shadow-lg",
        tone.border,
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <EligibilityStatusBadge status={course.status} />
        <SaveCourseButton courseId={course.courseId} />
      </div>

      <p className="mb-4 font-mono text-xs uppercase text-muted-foreground">
        {course.universityName ?? "Institution"}
        {course.isDemoCourse ? " · Demo data" : ""}
      </p>
      <h3 className="mb-2 font-display text-2xl font-semibold group-hover:text-primary">
        {course.courseName}
      </h3>
      <p className="text-sm text-muted-foreground">
        {[course.facultyName, course.provinceName].filter(Boolean).join(" · ") ||
          "Faculty not listed"}
      </p>

      {matchLabel ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          <span aria-hidden>★</span>
          <span className="font-bold text-foreground">{matchLabel}</span>
          {matchScore ? <span>· {matchScore}</span> : null}
        </p>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 font-mono text-xs">
        <div>
          <dt className="text-muted-foreground">Your APS</dt>
          <dd className="mt-1 text-base font-bold">{course.studentAps ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Required APS</dt>
          <dd className="mt-1 text-base font-bold">{course.requiredAps ?? "—"}</dd>
        </div>
      </dl>

      {gap ? <p className={cn("mt-5 text-sm", tone.text)}>{gap}</p> : null}

      <span className="mt-5 inline-block text-sm font-semibold text-primary">
        View course details →
      </span>
    </Link>
  );
}
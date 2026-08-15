import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { EligibilityStatusBadge } from "@/components/EligibilityStatusBadge";
import { SaveCourseButton } from "@/components/SaveCourseButton";
import { STATUS_TONE, summarizeGap } from "@/lib/eligibility-format";
import type { CourseEligibilityView } from "@/lib/eligibility-view";

export function EligibilityCourseCard({
  course,
  className,
}: {
  course: CourseEligibilityView;
  className?: string;
}) {
  const tone = STATUS_TONE[course.status];
  const gap = summarizeGap(course);

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
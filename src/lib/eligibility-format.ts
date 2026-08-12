/**
 * Presentation helpers for the eligibility engine's structured output.
 * No eligibility decisions are made here — statuses, outcomes and gaps all come
 * from the engine; this file only turns them into student-friendly text.
 */
import type {
  CourseEligibility,
  EligibilityStatus,
  RequirementCheck,
} from "@/lib/eligibility";

export const STATUS_LABEL: Record<EligibilityStatus, string> = {
  YOU_QUALIFY: "You qualify",
  ALMOST_QUALIFY: "Almost qualify",
  DONT_QUALIFY: "Don't qualify",
  MORE_INFORMATION_REQUIRED: "More information required",
};

export const STATUS_TONE: Record<EligibilityStatus, { dot: string; text: string; border: string }> = {
  YOU_QUALIFY: { dot: "bg-success", text: "text-success", border: "border-success/30" },
  ALMOST_QUALIFY: { dot: "bg-warning", text: "text-warning", border: "border-warning/30" },
  DONT_QUALIFY: { dot: "bg-muted-foreground", text: "text-muted-foreground", border: "border-border" },
  MORE_INFORMATION_REQUIRED: { dot: "bg-primary", text: "text-primary", border: "border-primary/30" },
};

function unitSuffix(check: RequirementCheck): string {
  if (check.unit === "percentage") return "%";
  if (check.unit === "aps") return " APS points";
  if (check.unit === "level") return " achievement levels";
  return " subjects";
}

/** One short line describing a single unmet or unknown requirement. */
export function describeCheck(check: RequirementCheck): string {
  if (check.outcome === "unknown") {
    return `${check.description} — we don't have a mark for this yet`;
  }
  if (check.gap != null) {
    return `${check.description} — short by ${check.gap}${unitSuffix(check)}`;
  }
  return check.description;
}

/** The requirements standing between the student and this course, in engine order. */
export function outstandingChecks(course: CourseEligibility): RequirementCheck[] {
  const checks = course.bestSet?.checks ?? [];
  return checks.filter((c) => c.outcome !== "met");
}

/** Short single-line reason shown on a card. */
export function summarizeGap(course: CourseEligibility): string | null {
  if (course.status === "YOU_QUALIFY") return null;
  const outstanding = outstandingChecks(course);
  if (outstanding.length === 0) {
    return course.status === "MORE_INFORMATION_REQUIRED"
      ? "Add your NSC results to see how you compare."
      : null;
  }
  const first = describeCheck(outstanding[0]!);
  return outstanding.length > 1 ? `${first} (+${outstanding.length - 1} more)` : first;
}
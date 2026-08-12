/**
 * Deterministic eligibility engine.
 *
 * Pure functions only: no network, no AI, no hard-coded universities or courses.
 * Everything is decided from the course's requirement records, the student's
 * results, and an institution-specific APS calculation.
 */
import type { ApsCalculation } from "@/lib/aps";
import type { CourseWithRequirements, RequirementRule, RequirementSet } from "@/lib/catalogue";
import { achievementLevelForMark } from "@/lib/results";
import {
  evaluateApsRequirement,
  evaluateSubjectPercentageRequirement,
  type RequirementOutcome,
  type ToleranceSettings,
} from "@/lib/tolerance";

export type EligibilityStatus =
  | "YOU_QUALIFY"
  | "ALMOST_QUALIFY"
  | "DONT_QUALIFY"
  | "MORE_INFORMATION_REQUIRED";

/** Per-rule outcome. `unknown` = the student has not supplied the data needed to judge it. */
export type RequirementCheckOutcome = RequirementOutcome | "unknown";

export type StudentResultInput = {
  subjectId: string;
  subjectName?: string | null;
  mark: number;
};

export type RequirementCheck = {
  ruleId: string;
  ruleType: RequirementRule["rule_type"] | "aps";
  description: string;
  outcome: RequirementCheckOutcome;
  /** What the course asks for (APS points, percentage, achievement level or subject count). */
  required: number | null;
  /** What the student achieved, when it could be determined. */
  actual: number | null;
  /** How far short the student is (positive number) — null when met or unknown. */
  gap: number | null;
  unit: "aps" | "percentage" | "level" | "count";
  subjectIds: string[];
  subjectNames: string[];
  isRequired: boolean;
};

export type RequirementSetEvaluation = {
  setId: string;
  setName: string;
  status: EligibilityStatus;
  checks: RequirementCheck[];
  passedCount: number;
  failedCount: number;
  unknownCount: number;
};

export type CourseEligibility = {
  courseId: string;
  courseName: string;
  courseCode: string | null;
  isDemoCourse: boolean;
  universityId: string | null;
  universityName: string | null;
  facultyName: string | null;
  qualificationName: string | null;
  status: EligibilityStatus;
  /** The APS calculation rule used for this course's institution. */
  apsCalculation: ApsCalculation | null;
  studentAps: number | null;
  requiredAps: number | null;
  apsGap: number | null;
  /** The requirement set that produced the overall status (best alternative). */
  bestSet: RequirementSetEvaluation | null;
  requirementSets: RequirementSetEvaluation[];
  /** Plain-language reasons the status is what it is. */
  notes: string[];
};

const STATUS_RANK: Record<EligibilityStatus, number> = {
  YOU_QUALIFY: 3,
  ALMOST_QUALIFY: 2,
  MORE_INFORMATION_REQUIRED: 1,
  DONT_QUALIFY: 0,
};

function nameFor(subjectId: string | null, names: Map<string, string>): string {
  if (!subjectId) return "Subject";
  return names.get(subjectId) ?? "Subject";
}

function compare(
  actual: number | null,
  required: number | null,
  evaluate: (a: number, r: number) => RequirementOutcome,
): { outcome: RequirementCheckOutcome; gap: number | null } {
  if (required == null) return { outcome: "met", gap: null };
  if (actual == null) return { outcome: "unknown", gap: null };
  const outcome = evaluate(actual, required);
  return { outcome, gap: outcome === "met" ? null : Math.round((required - actual) * 100) / 100 };
}

function levelOutcome(actual: number, required: number): RequirementOutcome {
  // Achievement levels are derived from percentages; tolerance is applied on the
  // percentage side only, so a level requirement is a strict pass/fail.
  return actual >= required ? "met" : "not_met";
}

function evaluateRule(
  rule: RequirementRule,
  marks: Map<string, number>,
  names: Map<string, string>,
  aps: number | null,
  tolerances: ToleranceSettings,
): RequirementCheck {
  const base = {
    ruleId: rule.id,
    ruleType: rule.rule_type,
    isRequired: rule.is_required,
  };

  switch (rule.rule_type) {
    case "min_aps": {
      const required = rule.min_aps ?? null;
      const { outcome, gap } = compare(aps, required, (a, r) =>
        evaluateApsRequirement(a, r, tolerances),
      );
      return {
        ...base,
        description: rule.description ?? `Minimum APS of ${required ?? "—"}`,
        outcome,
        required,
        actual: aps,
        gap,
        unit: "aps",
        subjectIds: [],
        subjectNames: [],
      };
    }
    case "subject_min_percentage": {
      const required = rule.min_percentage == null ? null : Number(rule.min_percentage);
      const actual = rule.subject_id ? (marks.get(rule.subject_id) ?? null) : null;
      const { outcome, gap } = compare(actual, required, (a, r) =>
        evaluateSubjectPercentageRequirement(a, r, tolerances),
      );
      const subjectName = nameFor(rule.subject_id, names);
      return {
        ...base,
        description: rule.description ?? `${subjectName} at ${required ?? "—"}%`,
        outcome,
        required,
        actual,
        gap,
        unit: "percentage",
        subjectIds: rule.subject_id ? [rule.subject_id] : [],
        subjectNames: rule.subject_id ? [subjectName] : [],
      };
    }
    case "subject_min_level": {
      const required = rule.min_achievement_level ?? null;
      const mark = rule.subject_id ? marks.get(rule.subject_id) : undefined;
      const actual = mark == null ? null : achievementLevelForMark(mark);
      const { outcome, gap } = compare(actual, required, levelOutcome);
      const subjectName = nameFor(rule.subject_id, names);
      return {
        ...base,
        description: rule.description ?? `${subjectName} at achievement level ${required ?? "—"}`,
        outcome,
        required,
        actual,
        gap,
        unit: "level",
        subjectIds: rule.subject_id ? [rule.subject_id] : [],
        subjectNames: rule.subject_id ? [subjectName] : [],
      };
    }
    case "one_of_subjects_min_percentage":
    case "one_of_subjects_min_level": {
      const isLevel = rule.rule_type === "one_of_subjects_min_level";
      const required = isLevel
        ? (rule.min_achievement_level ?? null)
        : rule.min_percentage == null
          ? null
          : Number(rule.min_percentage);
      const ids = rule.subject_ids ?? [];
      const values = ids
        .map((id) => marks.get(id))
        .filter((m): m is number => m != null)
        .map((m) => (isLevel ? achievementLevelForMark(m) : m));
      // Best of the alternatives decides the outcome.
      const actual = values.length ? Math.max(...values) : null;
      const { outcome, gap } = compare(actual, required, (a, r) =>
        isLevel ? levelOutcome(a, r) : evaluateSubjectPercentageRequirement(a, r, tolerances),
      );
      const subjectNames = ids.map((id) => nameFor(id, names));
      return {
        ...base,
        description:
          rule.description ??
          `One of ${subjectNames.join(", ")} at ${required ?? "—"}${isLevel ? " (level)" : "%"}`,
        // No marks at all for any alternative means we cannot judge it yet.
        outcome: values.length === 0 && ids.length > 0 ? "unknown" : outcome,
        required,
        actual,
        gap,
        unit: isLevel ? "level" : "percentage",
        subjectIds: ids,
        subjectNames,
      };
    }
    case "min_subject_count": {
      const required = rule.min_count ?? null;
      const ids = rule.subject_ids ?? [];
      const pool = ids.length ? ids.filter((id) => marks.has(id)) : [...marks.keys()];
      const actual = pool.length;
      const outcome: RequirementCheckOutcome =
        required == null ? "met" : actual >= required ? "met" : "not_met";
      return {
        ...base,
        description: rule.description ?? `At least ${required ?? "—"} subjects`,
        outcome,
        required,
        actual,
        gap: outcome === "met" || required == null ? null : required - actual,
        unit: "count",
        subjectIds: ids,
        subjectNames: ids.map((id) => nameFor(id, names)),
      };
    }
    default: {
      return {
        ...base,
        ruleType: rule.rule_type,
        description: rule.description ?? "Requirement",
        outcome: "unknown",
        required: null,
        actual: null,
        gap: null,
        unit: "count",
        subjectIds: [],
        subjectNames: [],
      };
    }
  }
}

function statusForChecks(checks: RequirementCheck[]): EligibilityStatus {
  const relevant = checks.filter((c) => c.isRequired);
  const considered = relevant.length ? relevant : checks;
  if (considered.some((c) => c.outcome === "not_met")) return "DONT_QUALIFY";
  if (considered.some((c) => c.outcome === "unknown")) return "MORE_INFORMATION_REQUIRED";
  if (considered.some((c) => c.outcome === "almost")) return "ALMOST_QUALIFY";
  return "YOU_QUALIFY";
}

function evaluateSet(
  set: RequirementSet,
  courseApsRequirement: number | null,
  marks: Map<string, number>,
  names: Map<string, string>,
  aps: number | null,
  tolerances: ToleranceSettings,
): RequirementSetEvaluation {
  const checks: RequirementCheck[] = [];

  const setAps = set.min_aps ?? courseApsRequirement ?? null;
  const hasApsRule = (set.course_requirement_rules ?? []).some((r) => r.rule_type === "min_aps");
  if (setAps != null && !hasApsRule) {
    const { outcome, gap } = compare(aps, setAps, (a, r) =>
      evaluateApsRequirement(a, r, tolerances),
    );
    checks.push({
      ruleId: `${set.id}:aps`,
      ruleType: "aps",
      description: `Minimum APS of ${setAps}`,
      outcome,
      required: setAps,
      actual: aps,
      gap,
      unit: "aps",
      subjectIds: [],
      subjectNames: [],
      isRequired: true,
    });
  }

  for (const rule of set.course_requirement_rules ?? []) {
    checks.push(evaluateRule(rule, marks, names, aps, tolerances));
  }

  return {
    setId: set.id,
    setName: set.name,
    status: checks.length ? statusForChecks(checks) : "MORE_INFORMATION_REQUIRED",
    checks,
    passedCount: checks.filter((c) => c.outcome === "met").length,
    failedCount: checks.filter((c) => c.outcome === "not_met" || c.outcome === "almost").length,
    unknownCount: checks.filter((c) => c.outcome === "unknown").length,
  };
}

export type EvaluateCourseInput = {
  course: CourseWithRequirements;
  /** APS calculated with the rule that this course's institution uses. */
  apsCalculation: ApsCalculation | null;
  results: StudentResultInput[];
  tolerances: ToleranceSettings;
  /** Optional subject id -> name lookup for readable output. */
  subjectNames?: Map<string, string>;
};

export function evaluateCourseEligibility(input: EvaluateCourseInput): CourseEligibility {
  const { course, apsCalculation, results, tolerances } = input;

  const names = new Map(input.subjectNames ?? []);
  for (const r of results) if (r.subjectName) names.set(r.subjectId, r.subjectName);

  const marks = new Map(results.map((r) => [r.subjectId, r.mark]));
  const studentAps = apsCalculation ? apsCalculation.totalAps : null;
  const notes: string[] = [];

  if (results.length === 0) notes.push("No NSC results captured yet.");
  if (!apsCalculation)
    notes.push("No APS calculation rule is linked to this institution, so APS was not compared.");
  else if (apsCalculation.ruleStatus !== "verified")
    notes.push(
      `APS calculated with ${apsCalculation.ruleName} (${apsCalculation.ruleStatus.toUpperCase()}).`,
    );

  const sets = course.course_requirement_sets ?? [];
  const requirementSets = sets.map((set) =>
    evaluateSet(set, course.aps_requirement ?? null, marks, names, studentAps, tolerances),
  );

  let bestSet: RequirementSetEvaluation | null = null;
  for (const set of requirementSets) {
    if (!bestSet || STATUS_RANK[set.status] > STATUS_RANK[bestSet.status]) bestSet = set;
  }

  let status: EligibilityStatus;
  if (results.length === 0) {
    status = "MORE_INFORMATION_REQUIRED";
  } else if (sets.length === 0 && course.aps_requirement == null) {
    status = "MORE_INFORMATION_REQUIRED";
    notes.push("This course has no published entry requirements yet.");
  } else if (sets.length === 0) {
    // Only a headline APS requirement exists on the course record.
    const { outcome } = compare(studentAps, course.aps_requirement ?? null, (a, r) =>
      evaluateApsRequirement(a, r, tolerances),
    );
    status =
      outcome === "met"
        ? "YOU_QUALIFY"
        : outcome === "almost"
          ? "ALMOST_QUALIFY"
          : outcome === "unknown"
            ? "MORE_INFORMATION_REQUIRED"
            : "DONT_QUALIFY";
  } else {
    status = bestSet ? bestSet.status : "MORE_INFORMATION_REQUIRED";
  }

  const requiredAps = bestSet
    ? (bestSet.checks.find((c) => c.unit === "aps")?.required ?? course.aps_requirement ?? null)
    : (course.aps_requirement ?? null);

  const apsGap =
    requiredAps != null && studentAps != null && studentAps < requiredAps
      ? requiredAps - studentAps
      : null;

  if (status !== "YOU_QUALIFY")
    notes.push("Meeting entry requirements never guarantees admission.");

  return {
    courseId: course.id,
    courseName: course.name,
    courseCode: course.code,
    isDemoCourse: course.is_demo,
    universityId: course.universities?.id ?? course.university_id ?? null,
    universityName: course.universities?.name ?? null,
    facultyName: course.faculties?.name ?? null,
    qualificationName: course.qualification_types?.name ?? null,
    status,
    apsCalculation,
    studentAps,
    requiredAps,
    apsGap,
    bestSet,
    requirementSets,
    notes,
  };
}

/** Evaluate many courses at once. Each course uses its own institution's APS calculation. */
export function evaluateCourses(
  courses: CourseWithRequirements[],
  options: {
    /** university id -> APS calculation for that institution's rule. */
    apsByUniversity: Map<string, ApsCalculation>;
    results: StudentResultInput[];
    tolerances: ToleranceSettings;
    subjectNames?: Map<string, string>;
  },
): CourseEligibility[] {
  return courses.map((course) =>
    evaluateCourseEligibility({
      course,
      apsCalculation: options.apsByUniversity.get(course.university_id) ?? null,
      results: options.results,
      tolerances: options.tolerances,
      subjectNames: options.subjectNames,
    }),
  );
}
import { describe, expect, it } from "vitest";
import type { ApsCalculation } from "@/lib/aps";
import type { CourseWithRequirements } from "@/lib/catalogue";
import { evaluateCourseEligibility } from "@/lib/eligibility";

const MATHS = "subject-maths";
const ENGLISH = "subject-english";

const tolerances = { apsTolerance: 5, subjectPercentageTolerance: 5 };

function aps(total: number): ApsCalculation {
  return {
    ruleId: "rule-1",
    ruleName: "Demo standard rule",
    ruleVersion: "v1",
    ruleStatus: "demo",
    totalAps: total,
    countingSubjectCount: 6,
    cappedAtMax: false,
    subjects: [],
    notes: [],
  };
}

function course(overrides?: Partial<CourseWithRequirements>): CourseWithRequirements {
  return {
    id: "course-1",
    university_id: "uni-1",
    faculty_id: null,
    qualification_type_id: null,
    code: "DEMO101",
    name: "Demo Programme",
    description: null,
    duration_years: 3,
    aps_requirement: 30,
    application_url: null,
    is_demo: true,
    universities: {
      id: "uni-1",
      name: "Demo University",
      short_name: "DU",
      province_id: "prov-1",
      is_demo: true,
    },
    faculties: null,
    qualification_types: null,
    course_requirement_sets: [
      {
        id: "set-1",
        course_id: "course-1",
        name: "Standard requirements",
        description: null,
        min_aps: 30,
        course_requirement_rules: [
          {
            id: "rule-maths",
            requirement_set_id: "set-1",
            rule_type: "subject_min_percentage",
            subject_id: MATHS,
            subject_ids: [],
            min_percentage: 70,
            min_achievement_level: null,
            min_aps: null,
            min_count: null,
            is_required: true,
            description: null,
          },
        ],
      },
    ],
    ...overrides,
  } as CourseWithRequirements;
}

function evaluate(total: number, marks: { subjectId: string; mark: number }[]) {
  return evaluateCourseEligibility({
    course: course(),
    apsCalculation: aps(total),
    results: marks,
    tolerances,
    subjectNames: new Map([
      [MATHS, "Mathematics"],
      [ENGLISH, "English Home Language"],
    ]),
  });
}

describe("eligibility engine", () => {
  it("qualifies when APS and subject requirements are met", () => {
    const r = evaluate(34, [
      { subjectId: MATHS, mark: 75 },
      { subjectId: ENGLISH, mark: 68 },
    ]);
    expect(r.status).toBe("YOU_QUALIFY");
    expect(r.studentAps).toBe(34);
    expect(r.requiredAps).toBe(30);
    expect(r.apsGap).toBeNull();
  });

  it("almost qualifies when APS falls short within tolerance", () => {
    const r = evaluate(27, [{ subjectId: MATHS, mark: 75 }]);
    expect(r.status).toBe("ALMOST_QUALIFY");
    expect(r.apsGap).toBe(3);
  });

  it("does not qualify when APS falls short beyond tolerance", () => {
    const r = evaluate(20, [{ subjectId: MATHS, mark: 75 }]);
    expect(r.status).toBe("DONT_QUALIFY");
    expect(r.apsGap).toBe(10);
  });

  it("almost qualifies on a subject mark within tolerance (70 required, 67 achieved)", () => {
    const r = evaluate(34, [{ subjectId: MATHS, mark: 67 }]);
    expect(r.status).toBe("ALMOST_QUALIFY");
    const check = r.bestSet?.checks.find((c) => c.ruleId === "rule-maths");
    expect(check?.outcome).toBe("almost");
    expect(check?.gap).toBe(3);
  });

  it("does not qualify when a subject mark falls short beyond tolerance", () => {
    const r = evaluate(34, [{ subjectId: MATHS, mark: 50 }]);
    expect(r.status).toBe("DONT_QUALIFY");
    expect(r.bestSet?.checks.find((c) => c.ruleId === "rule-maths")?.gap).toBe(20);
  });

  it("requires more information when the required subject is missing", () => {
    const r = evaluate(34, [{ subjectId: ENGLISH, mark: 80 }]);
    expect(r.status).toBe("MORE_INFORMATION_REQUIRED");
    expect(r.bestSet?.unknownCount).toBe(1);
  });

  it("requires more information when no results are captured", () => {
    const r = evaluate(0, []);
    expect(r.status).toBe("MORE_INFORMATION_REQUIRED");
  });

  it("picks the best alternative requirement set", () => {
    const withAlternative = course({
      course_requirement_sets: [
        ...course().course_requirement_sets,
        {
          id: "set-2",
          course_id: "course-1",
          name: "Alternative pathway",
          description: null,
          min_aps: 24,
          course_requirement_rules: [],
        },
      ],
    });
    const r = evaluateCourseEligibility({
      course: withAlternative,
      apsCalculation: aps(26),
      results: [{ subjectId: MATHS, mark: 40 }],
      tolerances,
    });
    expect(r.status).toBe("YOU_QUALIFY");
    expect(r.bestSet?.setId).toBe("set-2");
  });

  it("never lets tolerance turn a failed requirement into a met one", () => {
    const r = evaluate(27, [{ subjectId: MATHS, mark: 67 }]);
    const apsCheck = r.bestSet?.checks.find((c) => c.unit === "aps");
    expect(apsCheck?.outcome).toBe("almost");
    expect(r.status).not.toBe("YOU_QUALIFY");
  });
});
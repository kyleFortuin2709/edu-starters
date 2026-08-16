/**
 * Reusable eligibility service: loads the student's results, tolerances, the
 * course catalogue and each institution's APS rule, then runs the deterministic
 * engine. A future results dashboard only needs to call `evaluateMyEligibility`.
 */
import { calculateAps, fetchApsRules, type ApsCalculation } from "@/lib/aps";
import { calculatorToApsRule } from "@/lib/aps-calculator-rule";
import { fetchApsCalculators, type ApsCalculator } from "@/lib/aps-calculators-api";
import { fetchCoursesWithRequirements, type CourseWithRequirements } from "@/lib/catalogue";
import {
  evaluateCourses,
  type CourseEligibility,
  type StudentResultInput,
} from "@/lib/eligibility";
import { fetchMyProfile } from "@/lib/profile";
import { fetchMyResults, fetchSubjects } from "@/lib/results";
import { supabase } from "@/integrations/supabase/client";
import { toleranceSettings } from "@/lib/tolerance";

export type EligibilityReport = {
  results: StudentResultInput[];
  courses: CourseEligibility[];
  /** APS score per institution — the same results score differently per rule. */
  apsByUniversity: Map<string, ApsCalculation>;
  hasResults: boolean;
};

async function fetchUniversityRuleMap(): Promise<Map<string, string | null>> {
  const { data, error } = await supabase.from("universities").select("id, aps_rule_id");
  if (error) throw error;
  return new Map((data ?? []).map((u) => [u.id, u.aps_rule_id]));
}

export async function evaluateMyEligibility(
  userId: string,
  options?: { provinceId?: string; universityId?: string },
): Promise<EligibilityReport> {
  const [profile, rawResults, subjects, rules, universityRules, courses, calculators] =
    await Promise.all([
    fetchMyProfile(userId),
    fetchMyResults(userId),
    fetchSubjects(),
    fetchApsRules(),
    fetchUniversityRuleMap(),
    fetchCoursesWithRequirements(options),
      fetchApsCalculators({ includeArchived: false }).catch(() => [] as ApsCalculator[]),
    ]);

  const subjectNames = new Map(subjects.map((s) => [s.id, s.name]));
  const results: StudentResultInput[] = rawResults
    .filter((r) => r.subject_id && r.mark != null)
    .map((r) => ({
      subjectId: r.subject_id as string,
      subjectName: subjectNames.get(r.subject_id as string) ?? r.custom_subject_name,
      mark: Number(r.mark),
    }));

  const rulesById = new Map(rules.map((r) => [r.id, r]));
  const apsByRule = new Map<string, ApsCalculation>();
  const apsByUniversity = new Map<string, ApsCalculation>();

  // The institution's active general calculator wins; the legacy
  // `universities.aps_rule_id` link is only a fallback. Keeps this page in sync
  // with the APS scores shown on the profile page.
  const lifeOrientationId =
    subjects.find((s) => s.name.toLowerCase().includes("life orientation"))?.id ?? null;
  const activeGeneralByUniversity = new Map<string, ApsCalculator>();
  for (const calc of calculators) {
    if (calc.status !== "active" || calc.scope !== "GENERAL") continue;
    const existing = activeGeneralByUniversity.get(calc.university_id);
    if (!existing || calc.updated_at > existing.updated_at) {
      activeGeneralByUniversity.set(calc.university_id, calc);
    }
  }

  const universityIds = new Set<string>([
    ...universityRules.keys(),
    ...activeGeneralByUniversity.keys(),
  ]);

  for (const universityId of universityIds) {
    const calculator = activeGeneralByUniversity.get(universityId);
    const ruleId = universityRules.get(universityId) ?? null;
    const rule = calculator
      ? calculatorToApsRule(calculator, { lifeOrientationSubjectId: lifeOrientationId })
      : ruleId
        ? rulesById.get(ruleId)
        : undefined;
    if (!rule) continue;
    let calculation = apsByRule.get(rule.id);
    if (!calculation) {
      calculation = calculateAps(
        rule,
        results.map((r) => ({
          subjectId: r.subjectId,
          mark: r.mark,
          ...(r.subjectName ? { subjectName: r.subjectName } : {}),
        })),
      );
      apsByRule.set(rule.id, calculation);
    }
    apsByUniversity.set(universityId, calculation);
  }

  return {
    results,
    apsByUniversity,
    hasResults: results.length > 0,
    courses: evaluateCourses(courses as CourseWithRequirements[], {
      apsByUniversity,
      results,
      tolerances: toleranceSettings(profile),
      subjectNames,
    }),
  };
}
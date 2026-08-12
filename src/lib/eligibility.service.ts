/**
 * Reusable eligibility service: loads the student's results, tolerances, the
 * course catalogue and each institution's APS rule, then runs the deterministic
 * engine. A future results dashboard only needs to call `evaluateMyEligibility`.
 */
import { calculateAps, fetchApsRules, type ApsCalculation } from "@/lib/aps";
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
  const [profile, rawResults, subjects, rules, universityRules, courses] = await Promise.all([
    fetchMyProfile(userId),
    fetchMyResults(userId),
    fetchSubjects(),
    fetchApsRules(),
    fetchUniversityRuleMap(),
    fetchCoursesWithRequirements(options),
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
  for (const [universityId, ruleId] of universityRules) {
    if (!ruleId) continue;
    const rule = rulesById.get(ruleId);
    if (!rule) continue;
    let calculation = apsByRule.get(ruleId);
    if (!calculation) {
      calculation = calculateAps(
        rule,
        results.map((r) => ({
          subjectId: r.subjectId,
          mark: r.mark,
          ...(r.subjectName ? { subjectName: r.subjectName } : {}),
        })),
      );
      apsByRule.set(ruleId, calculation);
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
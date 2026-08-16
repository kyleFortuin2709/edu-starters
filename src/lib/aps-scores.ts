/**
 * Per-institution APS scores for the signed-in student. There is no universal
 * APS: each university references a calculation rule, so the same NSC results
 * can produce different scores.
 */
import { calculateAps, fetchApsRules, type ApsCalculation } from "@/lib/aps";
import { calculatorToApsRule } from "@/lib/aps-calculator-rule";
import { fetchApsCalculators, type ApsCalculator } from "@/lib/aps-calculators-api";
import { fetchUniversities } from "@/lib/catalogue";
import { fetchMyResults, fetchSubjects } from "@/lib/results";
import { supabase } from "@/integrations/supabase/client";

export type UniversityApsScore = {
  universityId: string;
  universityName: string;
  shortName: string | null;
  calculation: ApsCalculation | null;
};

export async function fetchMyApsByUniversity(userId: string): Promise<{
  hasResults: boolean;
  scores: UniversityApsScore[];
}> {
  const [rawResults, subjects, rules, universities, ruleLinks, calculators] = await Promise.all([
    fetchMyResults(userId),
    fetchSubjects(),
    fetchApsRules(),
    fetchUniversities(),
    supabase.from("universities").select("id, aps_rule_id"),
    fetchApsCalculators({ includeArchived: false }).catch(() => [] as ApsCalculator[]),
  ]);
  if (ruleLinks.error) throw ruleLinks.error;

  const subjectNames = new Map(subjects.map((s) => [s.id, s.name]));
  const results = rawResults
    .filter((r) => r.subject_id && r.mark != null)
    .map((r) => ({
      subjectId: r.subject_id as string,
      mark: Number(r.mark),
      ...(subjectNames.has(r.subject_id as string)
        ? { subjectName: subjectNames.get(r.subject_id as string) as string }
        : {}),
    }));

  const rulesById = new Map(rules.map((r) => [r.id, r]));
  const ruleByUniversity = new Map((ruleLinks.data ?? []).map((u) => [u.id, u.aps_rule_id]));
  const cache = new Map<string, ApsCalculation>();

  // The institution's active general calculator is the source of truth; the
  // legacy `universities.aps_rule_id` link is only a fallback.
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

  const scores = universities.map((u) => {
    const calculator = activeGeneralByUniversity.get(u.id);
    const ruleId = ruleByUniversity.get(u.id) ?? null;
    const rule = calculator
      ? calculatorToApsRule(calculator, { lifeOrientationSubjectId: lifeOrientationId })
      : ruleId
        ? rulesById.get(ruleId)
        : undefined;
    let calculation: ApsCalculation | null = null;
    if (rule && results.length > 0) {
      calculation = cache.get(rule.id) ?? calculateAps(rule, results);
      cache.set(rule.id, calculation);
    }
    return {
      universityId: u.id,
      universityName: u.name,
      shortName: u.short_name ?? null,
      calculation,
    };
  });

  return { hasResults: results.length > 0, scores };
}

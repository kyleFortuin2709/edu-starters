import { supabase } from "@/integrations/supabase/client";

/**
 * Reusable, data-driven APS system.
 *
 * A student's NSC results do NOT have one universal APS score. An APS score only
 * exists relative to a calculation rule:
 *
 *   Student NSC results + Calculation rule -> institution-specific APS score
 *
 * Nothing in this file is specific to a named institution: every knob (which
 * subjects count, how percentages map to points, how many subjects count,
 * caps and bonuses) comes from the database.
 */

export type ApsRuleStatus = "demo" | "unverified" | "verified";

export type ApsPointBand = {
  id: string;
  min_percentage: number;
  max_percentage: number;
  points: number;
  label: string | null;
};

export type ApsSubjectRuleType = "exclude" | "always_include" | "cap_points" | "bonus_points";

export type ApsRuleSubject = {
  id: string;
  subject_id: string;
  rule_type: ApsSubjectRuleType;
  max_points: number | null;
  bonus_points: number | null;
  notes: string | null;
};

export type ApsCalculationRule = {
  id: string;
  code: string;
  name: string;
  version: string;
  description: string | null;
  status: ApsRuleStatus;
  is_active: boolean;
  source_url: string | null;
  counting_subject_count: number | null;
  max_total_aps: number | null;
  special_rules: Record<string, unknown>;
  aps_point_bands: ApsPointBand[];
  aps_rule_subjects: ApsRuleSubject[];
};

const RULE_SELECT = `
  id, code, name, version, description, status, is_active, source_url,
  counting_subject_count, max_total_aps, special_rules,
  aps_point_bands ( id, min_percentage, max_percentage, points, label ),
  aps_rule_subjects ( id, subject_id, rule_type, max_points, bonus_points, notes )
`;

export async function fetchApsRules(): Promise<ApsCalculationRule[]> {
  const { data, error } = await supabase
    .from("aps_calculation_rules")
    .select(RULE_SELECT)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ApsCalculationRule[];
}

export async function fetchApsRule(ruleId: string): Promise<ApsCalculationRule | null> {
  const { data, error } = await supabase
    .from("aps_calculation_rules")
    .select(RULE_SELECT)
    .eq("id", ruleId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as ApsCalculationRule | null;
}

/** The APS rule a university uses (several universities may share one rule). */
export async function fetchApsRuleForUniversity(
  universityId: string,
): Promise<ApsCalculationRule | null> {
  const { data, error } = await supabase
    .from("universities")
    .select("aps_rule_id")
    .eq("id", universityId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.aps_rule_id) return null;
  return fetchApsRule(data.aps_rule_id);
}

export type ApsResultInput = {
  subjectId: string;
  subjectName?: string;
  mark: number;
};

export type ApsSubjectBreakdown = {
  subjectId: string;
  subjectName: string | null;
  mark: number;
  /** Points awarded by the rule's percentage bands, before caps/bonuses. */
  rawPoints: number | null;
  /** Points actually contributed to the total (0 when not counted). */
  points: number;
  counted: boolean;
  reason: string;
};

export type ApsCalculation = {
  ruleId: string;
  ruleName: string;
  ruleVersion: string;
  ruleStatus: ApsRuleStatus;
  totalAps: number;
  countingSubjectCount: number | null;
  cappedAtMax: boolean;
  subjects: ApsSubjectBreakdown[];
  /** Human-readable notes describing how the score was produced. */
  notes: string[];
};

function pointsForMark(rule: ApsCalculationRule, mark: number): number | null {
  // Prefer the most specific (narrowest) matching band so a badly captured
  // catch-all band (0-100) never masks a real one.
  const matches = rule.aps_point_bands.filter(
    (b) => mark >= Number(b.min_percentage) && mark <= Number(b.max_percentage),
  );
  if (matches.length === 0) return null;
  const band = matches.reduce((best, b) =>
    Number(b.max_percentage) - Number(b.min_percentage) <
    Number(best.max_percentage) - Number(best.min_percentage)
      ? b
      : best,
  );
  return band ? Number(band.points) : null;
}

/**
 * Calculate an APS score for one set of NSC results under one calculation rule.
 * Returns the total plus a full breakdown so the UI can show how it was derived.
 */
export function calculateAps(
  rule: ApsCalculationRule,
  results: ApsResultInput[],
): ApsCalculation {
  const bySubject = new Map(rule.aps_rule_subjects.map((r) => [`${r.subject_id}:${r.rule_type}`, r]));
  const notes: string[] = [];

  const scored: ApsSubjectBreakdown[] = results.map((result) => {
    const excluded = bySubject.get(`${result.subjectId}:exclude`);
    const raw = pointsForMark(rule, result.mark);
    const base: ApsSubjectBreakdown = {
      subjectId: result.subjectId,
      subjectName: result.subjectName ?? null,
      mark: result.mark,
      rawPoints: raw,
      points: 0,
      counted: false,
      reason: "",
    };

    if (excluded) {
      return { ...base, reason: excluded.notes ?? "Excluded by this calculation rule" };
    }
    if (raw === null) {
      return { ...base, reason: "No point band matches this mark" };
    }

    let points = raw;
    const cap = bySubject.get(`${result.subjectId}:cap_points`);
    if (cap?.max_points != null && points > cap.max_points) points = cap.max_points;
    const bonus = bySubject.get(`${result.subjectId}:bonus_points`);
    if (bonus?.bonus_points != null) points += bonus.bonus_points;

    return { ...base, points, counted: true, reason: "Counted" };
  });

  const alwaysInclude = new Set(
    rule.aps_rule_subjects.filter((r) => r.rule_type === "always_include").map((r) => r.subject_id),
  );

  const eligible = scored.filter((s) => s.counted);
  const limit = rule.counting_subject_count;
  let selected = eligible;

  if (limit != null && eligible.length > limit) {
    const mandatory = eligible.filter((s) => alwaysInclude.has(s.subjectId));
    const optional = eligible
      .filter((s) => !alwaysInclude.has(s.subjectId))
      .sort((a, b) => b.points - a.points || b.mark - a.mark);
    selected = [...mandatory, ...optional].slice(0, Math.max(limit, mandatory.length));
    notes.push(`Best ${limit} counting subjects are used.`);
  }

  const selectedIds = new Set(selected.map((s) => s.subjectId));
  const subjects = scored.map((s) =>
    s.counted && !selectedIds.has(s.subjectId)
      ? { ...s, points: 0, counted: false, reason: "Not counted in your best subjects" }
      : s,
  );

  let totalAps = subjects.reduce((sum, s) => sum + (s.counted ? s.points : 0), 0);
  let cappedAtMax = false;
  if (rule.max_total_aps != null && totalAps > rule.max_total_aps) {
    totalAps = rule.max_total_aps;
    cappedAtMax = true;
    notes.push(`Total capped at ${rule.max_total_aps} APS by this rule.`);
  }

  if (rule.status !== "verified") {
    notes.unshift(
      `This rule is marked ${rule.status.toUpperCase()} — the score is for demonstration only.`,
    );
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    ruleVersion: rule.version,
    ruleStatus: rule.status,
    totalAps,
    countingSubjectCount: limit,
    cappedAtMax,
    subjects,
    notes,
  };
}

/** Same results, many rules — one APS score per rule. */
export function calculateApsForRules(
  rules: ApsCalculationRule[],
  results: ApsResultInput[],
): ApsCalculation[] {
  return rules.map((rule) => calculateAps(rule, results));
}

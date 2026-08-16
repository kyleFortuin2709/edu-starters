/**
 * Bridge between the new APS calculator records and the existing rule-based
 * scorer. A calculator describes *how* an institution counts subjects
 * (`BEST_N`, weights, exclusions); this module turns that description into the
 * `ApsCalculationRule` shape the breakdown renderer already understands so a
 * student's score is shown even when no legacy rule row is linked.
 */
import type { ApsCalculationRule, ApsPointBand } from "@/lib/aps";
import type { ApsCalculator } from "@/lib/aps-calculators-api";

/** Standard NSC achievement levels (percentage -> points). */
const NSC_BANDS: { min: number; max: number; points: number; label: string }[] = [
  { min: 80, max: 100, points: 7, label: "Level 7" },
  { min: 70, max: 79.99, points: 6, label: "Level 6" },
  { min: 60, max: 69.99, points: 5, label: "Level 5" },
  { min: 50, max: 59.99, points: 4, label: "Level 4" },
  { min: 40, max: 49.99, points: 3, label: "Level 3" },
  { min: 30, max: 39.99, points: 2, label: "Level 2" },
  { min: 0, max: 29.99, points: 1, label: "Level 1" },
];

function bandsFor(calculatorId: string): ApsPointBand[] {
  return NSC_BANDS.map((b, index) => ({
    id: `${calculatorId}-band-${index}`,
    min_percentage: b.min,
    max_percentage: b.max,
    points: b.points,
    label: b.label,
  })) as ApsPointBand[];
}

/**
 * Build a rule from an active calculator.
 * `lifeOrientationSubjectId` lets the "exclude Life Orientation" flag work
 * without the calculator having to store the subject id.
 */
export function calculatorToApsRule(
  calculator: ApsCalculator,
  options?: { lifeOrientationSubjectId?: string | null },
): ApsCalculationRule {
  const config = calculator.configuration ?? {};
  const excluded = new Set<string>(config.exclude_subject_ids ?? []);
  if (config.exclude_life_orientation && options?.lifeOrientationSubjectId) {
    excluded.add(options.lifeOrientationSubjectId);
  }

  return {
    id: calculator.id,
    code: calculator.id,
    name: calculator.name,
    version: calculator.academic_year ?? "current",
    description: calculator.description,
    status: "verified",
    is_active: calculator.status === "active",
    source_url: null,
    counting_subject_count: typeof config.n === "number" ? config.n : null,
    max_total_aps: typeof config.max_total === "number" ? config.max_total : null,
    special_rules: {},
    aps_point_bands: bandsFor(calculator.id),
    aps_rule_subjects: [...excluded].map((subjectId, index) => ({
      id: `${calculator.id}-exclude-${index}`,
      subject_id: subjectId,
      rule_type: "exclude" as const,
      max_points: null,
      bonus_points: null,
      notes: null,
    })),
  };
}

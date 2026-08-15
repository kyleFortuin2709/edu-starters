/**
 * Client wrapper around the backend APS calculator system.
 *
 * IMPORTANT: no APS arithmetic and no resolution logic lives here. Every
 * calculation is performed by the database functions
 * (`calculate_aps_with_calculator`, `calculate_effective_aps`); this module
 * only reads and writes calculator records and renders what the backend
 * returns.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// The generated types file does not know about the calculator tables yet.
const db = supabase as unknown as SupabaseClient<any, "public", any>;

export type ApsCalculationType =
  | "BEST_N"
  | "BEST_N_REQUIRED_SUBJECTS"
  | "SPECIFIC_SUBJECTS"
  | "WEIGHTED"
  | "CUSTOM";

export type ApsCalculatorScope = "GENERAL" | "FACULTY";
export type ApsCalculatorStatus = "draft" | "active" | "archived";
export type ApsCalculatorSource = "manual" | "ai_suggested" | "ai_edited";
export type ApsResolutionMethod = "HIGHEST_APPLICABLE" | "FACULTY_OVERRIDES_GENERAL";

export const CALCULATION_TYPE_LABELS: Record<ApsCalculationType, string> = {
  BEST_N: "Best N",
  BEST_N_REQUIRED_SUBJECTS: "Best N + required subjects",
  SPECIFIC_SUBJECTS: "Specific subjects",
  WEIGHTED: "Weighted",
  CUSTOM: "Custom",
};

export const RESOLUTION_METHOD_LABELS: Record<ApsResolutionMethod, string> = {
  HIGHEST_APPLICABLE: "Highest applicable",
  FACULTY_OVERRIDES_GENERAL: "Faculty overrides general",
};

export type ApsCalculatorConfiguration = {
  n?: number;
  subject_ids?: string[];
  required_subject_ids?: string[];
  weights?: { subject_id: string; weight: number }[];
  default_weight?: number;
  exclude_subject_ids?: string[];
  exclude_life_orientation?: boolean;
  bonus_points?: number;
  max_total?: number;
  [key: string]: unknown;
};

export type ApsCalculator = {
  id: string;
  university_id: string;
  university_name: string | null;
  university_short_name: string | null;
  aps_resolution_method: ApsResolutionMethod;
  faculty_id: string | null;
  faculty_name: string | null;
  name: string;
  description: string | null;
  calculation_type: ApsCalculationType;
  scope: ApsCalculatorScope;
  academic_year: string | null;
  configuration: ApsCalculatorConfiguration;
  status: ApsCalculatorStatus;
  aps_rule_id: string | null;
  source: ApsCalculatorSource;
  prospectus_id: string | null;
  confidence: number | null;
  source_evidence: string | null;
  ambiguity_notes: string | null;
  notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToCalculator(row: any): ApsCalculator {
  return {
    ...row,
    configuration: (row.configuration ?? {}) as ApsCalculatorConfiguration,
    confidence: row.confidence == null ? null : Number(row.confidence),
  } as ApsCalculator;
}

export async function fetchApsCalculators(options?: {
  universityId?: string;
  prospectusId?: string;
  includeArchived?: boolean;
}): Promise<ApsCalculator[]> {
  let query = db.from("aps_calculator_overview").select("*");
  if (options?.universityId) query = query.eq("university_id", options.universityId);
  if (options?.prospectusId) query = query.eq("prospectus_id", options.prospectusId);
  if (!options?.includeArchived) query = query.neq("status", "archived");
  const { data, error } = await query
    .order("scope", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToCalculator);
}

export async function fetchApsCalculator(id: string): Promise<ApsCalculator | null> {
  const { data, error } = await db
    .from("aps_calculator_overview")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCalculator(data) : null;
}

export type ApsCalculatorInput = {
  id?: string | null;
  universityId: string;
  name: string;
  description?: string | null;
  calculationType: ApsCalculationType;
  scope: ApsCalculatorScope;
  facultyId?: string | null;
  academicYear?: string | null;
  configuration?: ApsCalculatorConfiguration;
  status?: ApsCalculatorStatus;
  apsRuleId?: string | null;
  notes?: string | null;
  source?: ApsCalculatorSource;
};

/** Create or update a calculator through the backend upsert function. */
export async function saveApsCalculator(input: ApsCalculatorInput): Promise<ApsCalculator> {
  const { data, error } = await db.rpc("upsert_aps_calculator", {
    _university_id: input.universityId,
    _name: input.name.trim(),
    _calculation_type: input.calculationType,
    _scope: input.scope,
    _configuration: input.configuration ?? {},
    _id: input.id ?? null,
    _faculty_id: input.scope === "FACULTY" ? (input.facultyId ?? null) : null,
    _description: input.description?.trim() || null,
    _academic_year: input.academicYear?.trim() || null,
    _status: input.status ?? "draft",
    _aps_rule_id: input.apsRuleId ?? null,
    _notes: input.notes?.trim() || null,
    _source: input.source ?? "manual",
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return rowToCalculator(row);
}

export async function setApsCalculatorStatus(
  id: string,
  status: ApsCalculatorStatus,
): Promise<void> {
  const { error } = await db.rpc("set_aps_calculator_status", { _id: id, _status: status });
  if (error) throw error;
}

export async function archiveApsCalculator(id: string): Promise<void> {
  await setApsCalculatorStatus(id, "archived");
}

/** Admin confirmation: an accepted calculator only goes live through here. */
export async function approveApsCalculator(id: string): Promise<void> {
  const { error } = await db.rpc("approve_aps_calculator", { _id: id });
  if (error) throw error;
}

export async function setInstitutionApsResolutionMethod(
  universityId: string,
  method: ApsResolutionMethod,
): Promise<void> {
  const { error } = await db.rpc("set_institution_aps_resolution_method", {
    _university_id: universityId,
    _method: method,
  });
  if (error) throw error;
}

export type ApplicableApsCalculator = {
  calculator_id: string;
  name: string;
  description: string | null;
  calculation_type: ApsCalculationType;
  scope: ApsCalculatorScope;
  faculty_id: string | null;
  academic_year: string | null;
  configuration: ApsCalculatorConfiguration;
};

export async function fetchApplicableApsCalculators(
  courseId: string,
  academicYear?: string | null,
): Promise<ApplicableApsCalculator[]> {
  const { data, error } = await db.rpc("get_applicable_aps_calculators", {
    _course_id: courseId,
    _academic_year: academicYear ?? null,
  });
  if (error) throw error;
  return (data ?? []) as ApplicableApsCalculator[];
}

export type EffectiveAps = {
  effective_aps: number;
  calculator_id: string;
  calculator_name: string;
  scope: ApsCalculatorScope;
  faculty_id: string | null;
  academic_year: string | null;
  resolution_method: ApsResolutionMethod;
};

/** Backend-calculated APS for a student on a course. Never recomputed here. */
export async function fetchEffectiveAps(
  profileId: string,
  courseId: string,
  academicYear?: string | null,
): Promise<EffectiveAps | null> {
  const { data, error } = await db.rpc("calculate_effective_aps", {
    _profile_id: profileId,
    _course_id: courseId,
    _academic_year: academicYear ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as EffectiveAps | null;
}

export type CalculatorGroup = {
  key: string;
  label: string;
  facultyId: string | null;
  calculators: ApsCalculator[];
};

/** Presentation only: GENERAL first, then one group per faculty. */
export function groupApsCalculators(calculators: ApsCalculator[]): CalculatorGroup[] {
  const general = calculators.filter((c) => c.scope === "GENERAL");
  const groups: CalculatorGroup[] = [
    { key: "GENERAL", label: "General", facultyId: null, calculators: general },
  ];
  const byFaculty = new Map<string, ApsCalculator[]>();
  for (const calc of calculators) {
    if (calc.scope !== "FACULTY" || !calc.faculty_id) continue;
    const list = byFaculty.get(calc.faculty_id) ?? [];
    list.push(calc);
    byFaculty.set(calc.faculty_id, list);
  }
  for (const [facultyId, list] of byFaculty) {
    groups.push({
      key: facultyId,
      label: list[0]?.faculty_name ?? "Faculty",
      facultyId,
      calculators: list,
    });
  }
  return groups.filter((g) => g.calculators.length > 0 || g.key === "GENERAL");
}

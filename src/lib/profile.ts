import { supabase } from "@/integrations/supabase/client";

export type Province = { id: string; name: string; code: string };

export type StudentProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  province_id: string | null;
  onboarding_completed_at: string | null;
  /** "Almost qualify" tolerances — never turn a failed requirement into a pass. */
  aps_tolerance: number;
  subject_percentage_tolerance: number;
};

export const DEFAULT_APS_TOLERANCE = 5;
export const DEFAULT_SUBJECT_PERCENTAGE_TOLERANCE = 5;

const PROFILE_SELECT =
  "id, first_name, last_name, province_id, onboarding_completed_at, aps_tolerance, subject_percentage_tolerance";

export async function fetchProvinces(): Promise<Province[]> {
  const { data, error } = await supabase
    .from("provinces")
    .select("id, name, code")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyProfile(userId: string): Promise<StudentProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Student-configurable tolerances used only by the "Almost Qualify" band. */
export async function saveMyTolerances(input: {
  userId: string;
  apsTolerance: number;
  subjectPercentageTolerance: number;
}) {
  const { error } = await supabase
    .from("profiles")
    .update({
      aps_tolerance: Math.max(0, Math.round(input.apsTolerance)),
      subject_percentage_tolerance: Math.max(0, Math.round(input.subjectPercentageTolerance)),
    })
    .eq("id", input.userId);
  if (error) throw error;
}

export async function saveMyProfile(input: {
  userId: string;
  firstName: string;
  lastName: string;
  provinceId: string;
}) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: input.userId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      province_id: input.provinceId,
      onboarding_completed_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export function isProfileComplete(profile: StudentProfile | null): boolean {
  return Boolean(profile?.first_name && profile?.last_name && profile?.province_id);
}

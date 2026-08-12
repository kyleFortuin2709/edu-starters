import { supabase } from "@/integrations/supabase/client";

export type Province = { id: string; name: string; code: string };

export type StudentProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  province_id: string | null;
  onboarding_completed_at: string | null;
};

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
    .select("id, first_name, last_name, province_id, onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
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

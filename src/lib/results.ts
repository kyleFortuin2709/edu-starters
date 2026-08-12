import { supabase } from "@/integrations/supabase/client";

export type Subject = {
  id: string;
  code: string;
  name: string;
  category: string;
  requirement_type: "required" | "elective";
  is_designated: boolean;
};

export type StudentResult = {
  id: string;
  subject_id: string | null;
  custom_subject_name: string | null;
  mark: number | null;
  achievement_level: number | null;
};

/** NSC achievement level (1-7) for a percentage mark. Stored for future APS work. */
export function achievementLevelForMark(mark: number): number {
  if (mark >= 80) return 7;
  if (mark >= 70) return 6;
  if (mark >= 60) return 5;
  if (mark >= 50) return 4;
  if (mark >= 40) return 3;
  if (mark >= 30) return 2;
  return 1;
}

export async function fetchSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, code, name, category, requirement_type, is_designated")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Subject[];
}

export async function fetchMyResults(profileId: string): Promise<StudentResult[]> {
  const { data, error } = await supabase
    .from("student_subjects")
    .select("id, subject_id, custom_subject_name, mark, achievement_level")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function countMyResults(profileId: string): Promise<number> {
  const { count, error } = await supabase
    .from("student_subjects")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if (error) throw error;
  return count ?? 0;
}

/** Replaces the student's saved results with the given rows (all scoped by RLS to their own profile). */
export async function saveMyResults(
  profileId: string,
  rows: { subjectId: string; mark: number }[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("student_subjects")
    .delete()
    .eq("profile_id", profileId);
  if (deleteError) throw deleteError;

  if (rows.length === 0) return;

  const { error } = await supabase.from("student_subjects").insert(
    rows.map((row) => ({
      profile_id: profileId,
      subject_id: row.subjectId,
      mark: row.mark,
      achievement_level: achievementLevelForMark(row.mark),
    })),
  );
  if (error) throw error;
}

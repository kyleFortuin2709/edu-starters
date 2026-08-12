import { supabase } from "@/integrations/supabase/client";

/** Saved (bookmarked) courses for the signed-in student. RLS scopes every row to them. */
export type SavedCourse = {
  id: string;
  course_id: string;
  created_at: string;
};

export async function fetchSavedCourseIds(profileId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("saved_courses")
    .select("course_id")
    .eq("profile_id", profileId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.course_id));
}

export async function saveCourse(profileId: string, courseId: string): Promise<void> {
  const { error } = await supabase
    .from("saved_courses")
    .upsert({ profile_id: profileId, course_id: courseId }, { onConflict: "profile_id,course_id" });
  if (error) throw error;
}

export async function unsaveCourse(profileId: string, courseId: string): Promise<void> {
  const { error } = await supabase
    .from("saved_courses")
    .delete()
    .eq("profile_id", profileId)
    .eq("course_id", courseId);
  if (error) throw error;
}

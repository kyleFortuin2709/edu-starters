import { supabase } from "@/integrations/supabase/client";

/**
 * Admin data access. Every query here relies on Supabase RLS: only users holding
 * the `admin` role can read draft records or write catalogue data. Nothing is
 * hard-coded to a named university, faculty or course.
 */

export type PublicationStatus = "draft" | "published";

export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export type AdminUniversity = {
  id: string;
  name: string;
  short_name: string | null;
  code: string;
  city: string | null;
  is_active: boolean;
  is_demo: boolean;
  publication_status: PublicationStatus;
  province_id: string;
  aps_rule_id: string | null;
  provinces: { id: string; name: string } | null;
};

export type AdminFaculty = {
  id: string;
  university_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  publication_status: PublicationStatus;
};

export type AdminCourse = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  duration_years: number | null;
  aps_requirement: number | null;
  application_url: string | null;
  is_active: boolean;
  is_demo: boolean;
  publication_status: PublicationStatus;
  university_id: string;
  faculty_id: string | null;
  qualification_type_id: string | null;
  universities: { id: string; name: string; short_name: string | null; province_id: string } | null;
  faculties: { id: string; name: string } | null;
  qualification_types: { id: string; name: string } | null;
};

const ADMIN_COURSE_SELECT = `
  id, name, code, description, duration_years, aps_requirement, application_url,
  is_active, is_demo, publication_status, university_id, faculty_id, qualification_type_id,
  universities:university_id ( id, name, short_name, province_id ),
  faculties:faculty_id ( id, name ),
  qualification_types:qualification_type_id ( id, name )
`;

export async function fetchAdminUniversities(): Promise<AdminUniversity[]> {
  const { data, error } = await supabase
    .from("universities")
    .select(
      "id, name, short_name, code, city, is_active, is_demo, publication_status, province_id, aps_rule_id, provinces:province_id ( id, name )",
    )
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AdminUniversity[];
}

/** Point a university at a different (or no) APS calculation rule. */
export async function setUniversityApsRule(
  universityId: string,
  ruleId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("universities")
    .update({ aps_rule_id: ruleId })
    .eq("id", universityId);
  if (error) throw error;
}

export type ApsBandDraft = { min: string; max: string; points: string; label: string };

/**
 * Update an APS calculation rule's headline settings and replace its
 * percentage bands. Bands are rewritten wholesale so the saved rule always
 * matches exactly what the administrator sees.
 */
export async function updateApsRule(
  ruleId: string,
  input: {
    name: string;
    version: string;
    description: string | null;
    countingSubjectCount: number | null;
    maxTotalAps: number | null;
    bands: ApsBandDraft[];
  },
): Promise<void> {
  const bands = input.bands
    .filter((b) => b.min !== "" || b.max !== "" || b.points !== "")
    .map((b, index) => ({
      min_percentage: Number(b.min),
      max_percentage: Number(b.max),
      points: Number(b.points),
      label: b.label.trim() || null,
      sort_order: index,
      rule_id: ruleId,
    }));
  if (bands.length === 0) throw new Error("Add at least one percentage band.");
  for (const band of bands) {
    if (
      !Number.isFinite(band.min_percentage) ||
      !Number.isFinite(band.max_percentage) ||
      !Number.isFinite(band.points) ||
      band.min_percentage < 0 ||
      band.max_percentage > 100 ||
      band.min_percentage > band.max_percentage ||
      band.points < 0
    ) {
      throw new Error("Every band needs a valid 0–100 range and a points value.");
    }
  }

  const { error } = await supabase
    .from("aps_calculation_rules")
    .update({
      name: input.name.trim(),
      version: input.version.trim() || "v1",
      description: input.description,
      counting_subject_count: input.countingSubjectCount,
      max_total_aps: input.maxTotalAps,
    })
    .eq("id", ruleId);
  if (error) throw error;

  const { error: deleteError } = await supabase
    .from("aps_point_bands")
    .delete()
    .eq("rule_id", ruleId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("aps_point_bands").insert(bands);
  if (insertError) throw insertError;
}

export async function fetchAdminFaculties(): Promise<AdminFaculty[]> {
  const { data, error } = await supabase
    .from("faculties")
    .select("id, university_id, name, code, is_active, publication_status")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AdminFaculty[];
}

export async function fetchAdminCourses(): Promise<AdminCourse[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(ADMIN_COURSE_SELECT)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AdminCourse[];
}

export type AdminRequirementRule = {
  id: string;
  rule_type: string;
  subject_id: string | null;
  subject_ids: string[];
  min_percentage: number | null;
  min_achievement_level: number | null;
  min_aps: number | null;
  min_count: number | null;
  is_required: boolean;
  description: string | null;
};

export type AdminRequirementSet = {
  id: string;
  name: string;
  description: string | null;
  min_aps: number | null;
  is_active: boolean;
  course_requirement_rules: AdminRequirementRule[];
};

export type AdminCourseDetail = AdminCourse & {
  course_requirement_sets: AdminRequirementSet[];
};

export async function fetchAdminCourse(courseId: string): Promise<AdminCourseDetail | null> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      `${ADMIN_COURSE_SELECT},
       course_requirement_sets (
         id, name, description, min_aps, is_active,
         course_requirement_rules (
           id, rule_type, subject_id, subject_ids, min_percentage,
           min_achievement_level, min_aps, min_count, is_required, description
         )
       )`,
    )
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as AdminCourseDetail | null;
}

export type CoursePatch = {
  name?: string;
  code?: string | null;
  description?: string | null;
  duration_years?: number | null;
  aps_requirement?: number | null;
  application_url?: string | null;
  faculty_id?: string | null;
  qualification_type_id?: string | null;
  is_active?: boolean;
  publication_status?: PublicationStatus;
};

export async function updateCourse(courseId: string, patch: CoursePatch): Promise<void> {
  const { error } = await supabase.from("courses").update(patch).eq("id", courseId);
  if (error) throw error;
}

export type AdminOverview = {
  universities: { total: number; published: number; draft: number };
  faculties: { total: number; published: number; draft: number };
  courses: { total: number; published: number; draft: number; active: number; inactive: number };
};

export function buildOverview(
  universities: AdminUniversity[],
  faculties: AdminFaculty[],
  courses: AdminCourse[],
): AdminOverview {
  const count = <T extends { publication_status: PublicationStatus }>(rows: T[]) => ({
    total: rows.length,
    published: rows.filter((r) => r.publication_status === "published").length,
    draft: rows.filter((r) => r.publication_status === "draft").length,
  });
  return {
    universities: count(universities),
    faculties: count(faculties),
    courses: {
      ...count(courses),
      active: courses.filter((c) => c.is_active).length,
      inactive: courses.filter((c) => !c.is_active).length,
    },
  };
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Data-driven course catalogue access.
 * Nothing here is specific to a named university, province, faculty or course —
 * everything is resolved from the database so new records need no code changes.
 */

export type Province = { id: string; code: string; name: string };

export type University = {
  id: string;
  province_id: string;
  code: string;
  name: string;
  short_name: string | null;
  description: string | null;
  city: string | null;
  website_url: string | null;
  application_url: string | null;
  logo_url: string | null;
  is_demo: boolean;
};

export type Faculty = {
  id: string;
  university_id: string;
  code: string | null;
  name: string;
  description: string | null;
};

export type QualificationType = {
  id: string;
  code: string;
  name: string;
  nqf_level: number | null;
};

export type RequirementRuleType =
  | "min_aps"
  | "subject_min_percentage"
  | "subject_min_level"
  | "one_of_subjects_min_percentage"
  | "one_of_subjects_min_level"
  | "min_subject_count";

export type RequirementRule = {
  id: string;
  requirement_set_id: string;
  rule_type: RequirementRuleType;
  subject_id: string | null;
  subject_ids: string[];
  min_percentage: number | null;
  min_achievement_level: number | null;
  min_aps: number | null;
  min_count: number | null;
  is_required: boolean;
  description: string | null;
};

/** A course can have several alternative requirement sets (any one may be satisfied). */
export type RequirementSet = {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  min_aps: number | null;
  course_requirement_rules: RequirementRule[];
};

export type Course = {
  id: string;
  university_id: string;
  faculty_id: string | null;
  qualification_type_id: string | null;
  code: string | null;
  name: string;
  description: string | null;
  duration_years: number | null;
  aps_requirement: number | null;
  application_url: string | null;
  is_demo: boolean;
  universities: Pick<University, "id" | "name" | "short_name" | "province_id" | "is_demo"> | null;
  faculties: Pick<Faculty, "id" | "name"> | null;
  qualification_types: Pick<QualificationType, "id" | "name" | "code"> | null;
};

export type CourseWithRequirements = Course & {
  course_requirement_sets: RequirementSet[];
};

const COURSE_SELECT = `
  id, university_id, faculty_id, qualification_type_id, code, name, description,
  duration_years, aps_requirement, application_url, is_demo,
  universities:university_id ( id, name, short_name, province_id, is_demo ),
  faculties:faculty_id ( id, name ),
  qualification_types:qualification_type_id ( id, name, code )
`;

const REQUIREMENTS_SELECT = `
  course_requirement_sets (
    id, course_id, name, description, min_aps,
    course_requirement_rules (
      id, requirement_set_id, rule_type, subject_id, subject_ids,
      min_percentage, min_achievement_level, min_aps, min_count, is_required, description
    )
  )
`;

export async function fetchProvinces(): Promise<Province[]> {
  const { data, error } = await supabase
    .from("provinces")
    .select("id, code, name")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Province[];
}

export async function fetchUniversities(options?: { provinceId?: string }): Promise<University[]> {
  let query = supabase
    .from("universities")
    .select(
      "id, province_id, code, name, short_name, description, city, website_url, application_url, logo_url, is_demo",
    )
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (options?.provinceId) query = query.eq("province_id", options.provinceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as University[];
}

export async function fetchFaculties(options?: { universityId?: string }): Promise<Faculty[]> {
  let query = supabase
    .from("faculties")
    .select("id, university_id, code, name, description")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (options?.universityId) query = query.eq("university_id", options.universityId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Faculty[];
}

export async function fetchQualificationTypes(): Promise<QualificationType[]> {
  const { data, error } = await supabase
    .from("qualification_types")
    .select("id, code, name, nqf_level")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as QualificationType[];
}

export async function fetchCourses(options?: {
  provinceId?: string;
  universityId?: string;
  facultyId?: string;
  qualificationTypeId?: string;
  limit?: number;
}): Promise<Course[]> {
  let query = supabase
    .from("courses")
    .select(COURSE_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.universityId) query = query.eq("university_id", options.universityId);
  if (options?.facultyId) query = query.eq("faculty_id", options.facultyId);
  if (options?.qualificationTypeId)
    query = query.eq("qualification_type_id", options.qualificationTypeId);
  if (options?.provinceId) query = query.eq("universities.province_id", options.provinceId);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Course[];
}

/** Full course record including every alternative requirement set and its rules. */
export async function fetchCourseWithRequirements(
  courseId: string,
): Promise<CourseWithRequirements | null> {
  const { data, error } = await supabase
    .from("courses")
    .select(`${COURSE_SELECT}, ${REQUIREMENTS_SELECT}`)
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as CourseWithRequirements | null;
}

/** Bulk load used later by the eligibility engine — data in, rules applied generically. */
export async function fetchCoursesWithRequirements(options?: {
  provinceId?: string;
  universityId?: string;
}): Promise<CourseWithRequirements[]> {
  let query = supabase
    .from("courses")
    .select(`${COURSE_SELECT}, ${REQUIREMENTS_SELECT}`)
    .order("sort_order", { ascending: true });
  if (options?.universityId) query = query.eq("university_id", options.universityId);
  if (options?.provinceId) query = query.eq("universities.province_id", options.provinceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as CourseWithRequirements[];
}

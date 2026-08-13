import { supabase } from "@/integrations/supabase/client";
import type { StagedCourse } from "./prospectus";

/**
 * Faculty standardisation for the prospectus review workflow.
 *
 * The AI reports whatever faculty wording the document uses. A reviewer maps
 * each scraped wording onto ONE standardised faculty for the institution —
 * either an existing faculty record or a newly created one — so publishing no
 * longer creates near-duplicate faculties from spelling differences.
 */

export type Faculty = {
  id: string;
  university_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  publication_status: "draft" | "published";
};

const FACULTY_SELECT = `id, university_id, name, code, is_active, publication_status`;

export function normaliseFacultyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function fetchFaculties(universityId: string): Promise<Faculty[]> {
  const { data, error } = await supabase
    .from("faculties")
    .select(FACULTY_SELECT)
    .eq("university_id", universityId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Faculty[];
}

/** Faculties created during review start as drafts until the reviewer publishes them. */
export async function createFaculty(universityId: string, name: string): Promise<Faculty> {
  const { data, error } = await supabase
    .from("faculties")
    .insert({
      university_id: universityId,
      name: name.trim(),
      is_active: true,
      publication_status: "draft",
    })
    .select(FACULTY_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as Faculty;
}

export async function publishFaculty(id: string): Promise<void> {
  const { error } = await supabase
    .from("faculties")
    .update({ publication_status: "published", is_active: true })
    .eq("id", id);
  if (error) throw error;
}

export type FacultyGroup = {
  /** Exactly what the AI scraped (null when nothing was found). */
  scraped: string | null;
  courses: StagedCourse[];
  /** Existing faculty whose name matches the scraped wording, if any. */
  match: Faculty | null;
};

/** Group staged courses by the faculty wording the AI scraped. */
export function groupByFaculty(staged: StagedCourse[], faculties: Faculty[]): FacultyGroup[] {
  const map = new Map<string, FacultyGroup>();
  for (const course of staged) {
    const scraped = course.faculty_name?.trim() || null;
    const key = scraped ? normaliseFacultyName(scraped) : "__none__";
    let group = map.get(key);
    if (!group) {
      group = {
        scraped,
        courses: [],
        match: scraped
          ? faculties.find((f) => normaliseFacultyName(f.name) === normaliseFacultyName(scraped)) ?? null
          : null,
      };
      map.set(key, group);
    }
    group.courses.push(course);
  }
  return [...map.values()].sort((a, b) => (a.scraped ?? "").localeCompare(b.scraped ?? ""));
}

/**
 * Rewrite the faculty wording on every staged course in a group so it matches
 * the standardised faculty name. Returns how many staged rows changed.
 */
export async function applyFacultyToGroup(input: {
  prospectusId: string;
  courseIds: string[];
  facultyName: string;
}): Promise<number> {
  if (input.courseIds.length === 0) return 0;
  const { data, error } = await supabase
    .from("staged_courses")
    .update({ faculty_name: input.facultyName.trim() })
    .eq("prospectus_id", input.prospectusId)
    .neq("status", "published")
    .in("id", input.courseIds)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

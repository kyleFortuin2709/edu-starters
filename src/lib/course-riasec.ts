/**
 * Client helpers for course interest (RIASEC) profiles.
 *
 * These profiles are what the backend `get_course_recommendations` function
 * needs in order to score a course against a student's questionnaire result.
 * Nothing here scores anything — the backend stays the source of truth.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { RIASEC_ORDER, type RiasecDimension } from "@/lib/career";

const db = supabase as unknown as SupabaseClient<any, "public", any>;

export type CourseRiasecProfile = {
  courseId: string;
  scores: Record<RiasecDimension, number>;
  notes: string | null;
  /** Recommendations only use a profile once an admin has approved it. */
  isReviewed: boolean;
};

const COLUMN_BY_DIMENSION: Record<RiasecDimension, string> = {
  R: "realistic_score",
  I: "investigative_score",
  A: "artistic_score",
  S: "social_score",
  E: "enterprising_score",
  C: "conventional_score",
};

function rowToProfile(row: any): CourseRiasecProfile {
  const scores = {} as Record<RiasecDimension, number>;
  for (const dim of RIASEC_ORDER) scores[dim] = Number(row[COLUMN_BY_DIMENSION[dim]] ?? 0);
  return {
    courseId: row.course_id,
    scores,
    notes: row.notes ?? null,
    isReviewed: Boolean(row.is_reviewed),
  };
}

export async function fetchCourseRiasecProfiles(
  courseIds?: string[],
): Promise<Map<string, CourseRiasecProfile>> {
  const map = new Map<string, CourseRiasecProfile>();
  if (courseIds && courseIds.length === 0) return map;

  let query = db
    .from("course_riasec_profiles")
    .select(
      "course_id, realistic_score, investigative_score, artistic_score, social_score, enterprising_score, conventional_score, notes, is_reviewed",
    );
  if (courseIds) query = query.in("course_id", courseIds);

  const { data, error } = await query;
  if (error) throw error;
  for (const row of data ?? []) {
    const profile = rowToProfile(row);
    map.set(profile.courseId, profile);
  }
  return map;
}

export async function saveCourseRiasecProfile(profile: CourseRiasecProfile) {
  const payload: Record<string, unknown> = {
    course_id: profile.courseId,
    notes: profile.notes,
    is_reviewed: profile.isReviewed,
    reviewed_at: profile.isReviewed ? new Date().toISOString() : null,
  };
  for (const dim of RIASEC_ORDER) {
    payload[COLUMN_BY_DIMENSION[dim]] = Math.round(profile.scores[dim]);
  }
  const { error } = await db
    .from("course_riasec_profiles")
    .upsert(payload, { onConflict: "course_id" });
  if (error) throw error;
}

/** Approving a profile is what makes the backend use it for recommendations. */
export async function setCourseRiasecReviewed(courseIds: string[], reviewed: boolean) {
  if (courseIds.length === 0) return;
  const { error } = await db
    .from("course_riasec_profiles")
    .update({ is_reviewed: reviewed, reviewed_at: reviewed ? new Date().toISOString() : null })
    .in("course_id", courseIds);
  if (error) throw error;
}

/** Dimensions ordered strongest first, ignoring anything at or below zero. */
export function topDimensions(
  scores: Record<RiasecDimension, number>,
  limit = 2,
): RiasecDimension[] {
  return RIASEC_ORDER.filter((d) => (scores[d] ?? 0) > 0)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, limit);
}

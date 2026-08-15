/**
 * Thin client for the backend recommendation layer.
 *
 * The backend RPC `get_course_recommendations` is the single source of truth for
 * recommendation_score and recommendation_strength. Nothing here recalculates a
 * score, and none of this touches eligibility, APS or admission requirements —
 * recommendations only affect ordering *within* an existing eligibility group.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { RIASEC_META, type RiasecDimension } from "@/lib/career";
import { topDimensions, type CourseRiasecProfile } from "@/lib/course-riasec";

const db = supabase as unknown as SupabaseClient<any, "public", any>;

export type CourseRecommendation = {
  courseId: string;
  score: number | null;
  strength: string | null;
  available: boolean;
  unavailableReason: string | null;
};

export type RecommendationMap = Map<string, CourseRecommendation>;

export async function fetchCourseRecommendations(
  profileId: string,
  courseIds: string[],
): Promise<RecommendationMap> {
  const map: RecommendationMap = new Map();
  if (courseIds.length === 0) return map;

  const { data, error } = await db.rpc("get_course_recommendations", {
    _profile_id: profileId,
    _course_ids: courseIds,
  });
  if (error) throw error;

  for (const row of (data ?? []) as any[]) {
    const score = row.recommendation_score == null ? null : Number(row.recommendation_score);
    map.set(row.course_id, {
      courseId: row.course_id,
      score,
      strength: row.recommendation_strength ?? null,
      available: Boolean(row.recommendation_available),
      unavailableReason: row.unavailable_reason ?? null,
    });
  }
  return map;
}

/** Student-friendly label. Never framed as a chance/probability of admission. */
export function recommendationLabel(rec: CourseRecommendation): string | null {
  if (!rec.available) return null;
  const raw = (rec.strength ?? "").toLowerCase();
  if (raw.includes("strong")) return "Strong match";
  if (raw.includes("good")) return "Good match";
  if (raw.includes("moderate")) return "Moderate match";
  if (raw.includes("low") || raw.includes("weak")) return "Low match";
  const score = rec.score;
  if (score == null) return null;
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Good match";
  if (score >= 40) return "Moderate match";
  return "Low match";
}

export function recommendationScoreText(rec: CourseRecommendation): string | null {
  if (!rec.available || rec.score == null) return null;
  return `${Math.round(rec.score)}% recommendation match`;
}

/** Visual tone for the match badge, keyed off the student-friendly label. */
export function recommendationTone(label: string | null): string {
  switch (label) {
    case "Strong match":
      return "border-primary/30 bg-primary/10 text-primary";
    case "Good match":
      return "border-accent/30 bg-accent/10 text-accent";
    case "Moderate match":
      return "border-warning/30 bg-warning/10 text-warning";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

/**
 * Plain-English reason for the badge. Purely descriptive: it names the interest
 * dimensions the student and the course have in common. It never computes or
 * adjusts the backend's recommendation score.
 */
export function recommendationReason(
  studentScores: Record<RiasecDimension, number> | null | undefined,
  courseProfile: CourseRiasecProfile | null | undefined,
): string | null {
  if (!studentScores || !courseProfile) return null;
  const studentTop = topDimensions(studentScores, 3);
  const courseTop = topDimensions(courseProfile.scores, 3);
  const shared = courseTop.filter((d) => studentTop.includes(d));
  const names = (shared.length > 0 ? shared : courseTop.slice(0, 2)).map(
    (d) => RIASEC_META[d].name,
  );
  if (names.length === 0) return null;
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return shared.length > 0
    ? `Fits your ${joined} interests`
    : `Mostly ${joined} work`;
}

/**
 * Orders courses by recommendation score, highest first. Callers pass a list
 * that is already restricted to one eligibility group, so groups never mix.
 */
export function sortByRecommendation<T extends { courseId: string }>(
  courses: T[],
  recommendations: RecommendationMap | null,
): T[] {
  if (!recommendations || recommendations.size === 0) return courses;
  const scoreOf = (id: string) => {
    const rec = recommendations.get(id);
    return rec?.available && rec.score != null ? rec.score : null;
  };
  return [...courses].sort((a, b) => {
    const sa = scoreOf(a.courseId);
    const sb = scoreOf(b.courseId);
    if (sa == null && sb == null) return 0;
    if (sa == null) return 1;
    if (sb == null) return -1;
    return sb - sa;
  });
}

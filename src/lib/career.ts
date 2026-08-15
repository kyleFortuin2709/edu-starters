import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// The career questionnaire tables live in the project's own backend and are not
// part of the generated Database types yet, so use an untyped view of the client.
const db = supabase as unknown as SupabaseClient<any, "public", any>;

export type RiasecDimension = "R" | "I" | "A" | "S" | "E" | "C";

export type CareerQuestionOption = {
  id: string;
  option_label: string;
  option_text: string;
  dimension: RiasecDimension;
  sort_order: number;
};

export type CareerQuestion = {
  id: string;
  question_number: number;
  prompt: string;
  options: CareerQuestionOption[];
};

export type CareerProfileResult = {
  totalAnswered: number;
  completedAt: string | null;
  percentages: Record<RiasecDimension, number>;
};

export const RIASEC_META: Record<
  RiasecDimension,
  { name: string; tagline: string; description: string; accent: string }
> = {
  R: {
    name: "Realistic",
    tagline: "The Doer",
    description: "You enjoy hands-on, practical work — building, fixing, and working with tools, machines or the outdoors.",
    accent: "bg-primary/10 text-primary border-primary/20",
  },
  I: {
    name: "Investigative",
    tagline: "The Thinker",
    description: "You like solving problems, researching, experimenting and understanding how and why things work.",
    accent: "bg-accent/10 text-accent border-accent/20",
  },
  A: {
    name: "Artistic",
    tagline: "The Creator",
    description: "You are drawn to creative, expressive work — design, writing, music, performance and original ideas.",
    accent: "bg-warning/10 text-warning border-warning/20",
  },
  S: {
    name: "Social",
    tagline: "The Helper",
    description: "You enjoy teaching, supporting, healing and working closely with other people.",
    accent: "bg-primary/10 text-primary border-primary/20",
  },
  E: {
    name: "Enterprising",
    tagline: "The Persuader",
    description: "You like leading, selling, persuading and starting things — business, projects and teams.",
    accent: "bg-accent/10 text-accent border-accent/20",
  },
  C: {
    name: "Conventional",
    tagline: "The Organiser",
    description: "You like structure, accuracy and order — data, records, planning and getting details right.",
    accent: "bg-warning/10 text-warning border-warning/20",
  },
};

export const RIASEC_ORDER: RiasecDimension[] = ["R", "I", "A", "S", "E", "C"];

export async function fetchCareerQuestions(): Promise<CareerQuestion[]> {
  const { data, error } = await db
    .from("career_questions")
    .select(
      "id, question_number, prompt, is_active, sort_order, career_question_options(id, option_label, option_text, dimension, sort_order)",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    question_number: row.question_number,
    prompt: row.prompt,
    options: [...(row.career_question_options ?? [])].sort(
      (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    ),
  }));
}

/** Existing answers for this student, keyed by question id. */
export async function fetchMyCareerResponses(profileId: string): Promise<Record<string, string>> {
  const { data, error } = await db
    .from("career_responses")
    .select("question_id, option_id")
    .eq("profile_id", profileId);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[(row as any).question_id] = (row as any).option_id;
  return map;
}

export async function saveCareerResponse(input: {
  profileId: string;
  questionId: string;
  optionId: string;
}) {
  const { error } = await db.from("career_responses").upsert(
    {
      profile_id: input.profileId,
      question_id: input.questionId,
      option_id: input.optionId,
    },
    { onConflict: "profile_id,question_id" },
  );
  if (error) throw error;
}

/** Recomputes the six-dimension profile from the saved answers. */
export async function submitCareerQuestionnaire(profileId: string) {
  const { error } = await db.rpc("recalculate_career_profile", { p_profile_id: profileId });
  if (error) throw error;
}

export async function fetchMyCareerProfile(profileId: string): Promise<CareerProfileResult | null> {
  const { data, error } = await db
    .from("career_profile_percentages")
    .select(
      "total_questions_answered, completed_at, realistic_percent, investigative_percent, artistic_percent, social_percent, enterprising_percent, conventional_percent",
    )
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  return {
    totalAnswered: row.total_questions_answered ?? 0,
    completedAt: row.completed_at ?? null,
    percentages: {
      R: Number(row.realistic_percent ?? 0),
      I: Number(row.investigative_percent ?? 0),
      A: Number(row.artistic_percent ?? 0),
      S: Number(row.social_percent ?? 0),
      E: Number(row.enterprising_percent ?? 0),
      C: Number(row.conventional_percent ?? 0),
    },
  };
}

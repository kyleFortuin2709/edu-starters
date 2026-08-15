import { supabase } from "@/integrations/supabase/client";

export type AdvisorTurn = { role: "user" | "assistant"; content: string };

export type AdvisorConversation = {
  id: string;
  courseId: string;
  courseName: string;
  universityName: string | null;
  facultyName: string | null;
  messages: AdvisorTurn[];
  updatedAt: string;
};

function parseTurns(value: unknown): AdvisorTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { role?: unknown; content?: unknown };
    if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") {
      return [];
    }
    return [{ role: row.role, content: row.content }];
  });
}

/** The stored advisor chat for one course, or null if the student hasn't asked anything yet. */
export async function fetchConversation(
  profileId: string,
  courseId: string,
): Promise<AdvisorTurn[]> {
  const { data, error } = await supabase
    .from("advisor_conversations")
    .select("messages")
    .eq("profile_id", profileId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  return parseTurns(data?.messages);
}

export async function saveConversation(
  profileId: string,
  courseId: string,
  messages: AdvisorTurn[],
): Promise<void> {
  const { error } = await supabase.from("advisor_conversations").upsert(
    { profile_id: profileId, course_id: courseId, messages },
    { onConflict: "profile_id,course_id" },
  );
  if (error) throw error;
}

export async function deleteConversation(profileId: string, courseId: string): Promise<void> {
  const { error } = await supabase
    .from("advisor_conversations")
    .delete()
    .eq("profile_id", profileId)
    .eq("course_id", courseId);
  if (error) throw error;
}

/** All saved advisor chats for the student, newest first, with course context for grouping. */
export async function fetchMyConversations(profileId: string): Promise<AdvisorConversation[]> {
  const { data, error } = await supabase
    .from("advisor_conversations")
    .select(
      "id, course_id, messages, updated_at, courses(name, universities(name), faculties(name))",
    )
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const course = row.courses as
      | { name?: string | null; universities?: { name?: string | null } | null; faculties?: { name?: string | null } | null }
      | null;
    return {
      id: row.id,
      courseId: row.course_id,
      courseName: course?.name ?? "Course",
      universityName: course?.universities?.name ?? null,
      facultyName: course?.faculties?.name ?? null,
      messages: parseTurns(row.messages),
      updatedAt: row.updated_at,
    };
  });
}

import { supabase } from "@/integrations/supabase/client";

export type AdvisorTurn = { role: "user" | "assistant"; content: string };

export type CourseMeta = {
  courseName?: string | null;
  universityName?: string | null;
  facultyName?: string | null;
};

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

/* ------------------------------------------------------------------ */
/* Local mirror                                                        */
/* Conversations are always written to the browser too, so a chat is   */
/* never lost when the backend table is unavailable or a request fails.*/
/* ------------------------------------------------------------------ */

const localKey = (profileId: string) => `edustarter.advisor.${profileId}`;

type LocalRecord = AdvisorConversation;

function readLocal(profileId: string): LocalRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(localKey(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): LocalRecord[] => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (typeof row["courseId"] !== "string") return [];
      return [
        {
          id: typeof row["id"] === "string" ? row["id"] : `local-${row["courseId"]}`,
          courseId: row["courseId"] as string,
          courseName: typeof row["courseName"] === "string" ? row["courseName"] : "Course",
          universityName:
            typeof row["universityName"] === "string" ? row["universityName"] : null,
          facultyName: typeof row["facultyName"] === "string" ? row["facultyName"] : null,
          messages: parseTurns(row["messages"]),
          updatedAt:
            typeof row["updatedAt"] === "string" ? row["updatedAt"] : new Date(0).toISOString(),
        },
      ];
    });
  } catch {
    return [];
  }
}

function writeLocal(profileId: string, records: LocalRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localKey(profileId), JSON.stringify(records));
  } catch {
    /* storage full or unavailable — nothing else we can do */
  }
}

function upsertLocal(
  profileId: string,
  courseId: string,
  messages: AdvisorTurn[],
  meta: CourseMeta,
): void {
  const records = readLocal(profileId);
  const existing = records.find((r) => r.courseId === courseId);
  const next: LocalRecord = {
    id: existing?.id ?? `local-${courseId}`,
    courseId,
    courseName: meta.courseName ?? existing?.courseName ?? "Course",
    universityName: meta.universityName ?? existing?.universityName ?? null,
    facultyName: meta.facultyName ?? existing?.facultyName ?? null,
    messages,
    updatedAt: new Date().toISOString(),
  };
  writeLocal(profileId, [next, ...records.filter((r) => r.courseId !== courseId)]);
}

function removeLocal(profileId: string, courseId: string): void {
  writeLocal(
    profileId,
    readLocal(profileId).filter((r) => r.courseId !== courseId),
  );
}

/* ------------------------------------------------------------------ */

/** The stored advisor chat for one course, or [] if there isn't one yet. */
export async function fetchConversation(
  profileId: string,
  courseId: string,
): Promise<AdvisorTurn[]> {
  const local = readLocal(profileId).find((r) => r.courseId === courseId);
  try {
    const { data, error } = await supabase
      .from("advisor_conversations")
      .select("messages")
      .eq("profile_id", profileId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (error) throw error;
    const remote = parseTurns(data?.messages);
    if (remote.length) return remote;
  } catch {
    /* fall through to the local mirror */
  }
  return local?.messages ?? [];
}

export async function saveConversation(
  profileId: string,
  courseId: string,
  messages: AdvisorTurn[],
  meta: CourseMeta = {},
): Promise<void> {
  upsertLocal(profileId, courseId, messages, meta);
  const { error } = await supabase.from("advisor_conversations").upsert(
    { profile_id: profileId, course_id: courseId, messages },
    { onConflict: "profile_id,course_id" },
  );
  if (error) console.warn("advisor conversation not saved to the backend", error.message);
}

export async function deleteConversation(profileId: string, courseId: string): Promise<void> {
  removeLocal(profileId, courseId);
  const { error } = await supabase
    .from("advisor_conversations")
    .delete()
    .eq("profile_id", profileId)
    .eq("course_id", courseId);
  if (error) console.warn("advisor conversation not deleted on the backend", error.message);
}

/** All saved advisor chats for the student, newest first, with course context. */
export async function fetchMyConversations(profileId: string): Promise<AdvisorConversation[]> {
  const local = readLocal(profileId);
  let remote: AdvisorConversation[] = [];

  try {
    const { data, error } = await supabase
      .from("advisor_conversations")
      .select(
        "id, course_id, messages, updated_at, courses(name, universities(name), faculties(name))",
      )
      .eq("profile_id", profileId)
      .order("updated_at", { ascending: false });
    if (error) throw error;

    remote = (data ?? []).map((row) => {
      const course = row.courses as
        | {
            name?: string | null;
            universities?: { name?: string | null } | null;
            faculties?: { name?: string | null } | null;
          }
        | null;
      const mirrored = local.find((r) => r.courseId === row.course_id);
      return {
        id: row.id,
        courseId: row.course_id,
        courseName: course?.name ?? mirrored?.courseName ?? "Course",
        universityName: course?.universities?.name ?? mirrored?.universityName ?? null,
        facultyName: course?.faculties?.name ?? mirrored?.facultyName ?? null,
        messages: parseTurns(row.messages),
        updatedAt: row.updated_at,
      };
    });
  } catch (caught) {
    console.warn("advisor conversations came from the local mirror only", caught);
  }

  const byCourse = new Map<string, AdvisorConversation>();
  for (const record of [...local, ...remote]) {
    const existing = byCourse.get(record.courseId);
    // Prefer whichever copy has the most messages, then the newest.
    if (
      !existing ||
      record.messages.length > existing.messages.length ||
      (record.messages.length === existing.messages.length &&
        record.updatedAt > existing.updatedAt)
    ) {
      byCourse.set(record.courseId, record);
    }
  }

  return [...byCourse.values()]
    .filter((c) => c.messages.length > 0)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase-auth.middleware";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";
import { getRequest } from "@tanstack/react-start/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase-env";

const responseSchema = z.object({
  courses: z.array(
    z.object({
      course_id: z.string(),
      realistic: z.number(),
      investigative: z.number(),
      artistic: z.number(),
      social: z.number(),
      enterprising: z.number(),
      conventional: z.number(),
      notes: z.string(),
    }),
  ),
});

const DIMENSION_KEYS = [
  "realistic",
  "investigative",
  "artistic",
  "social",
  "enterprising",
  "conventional",
] as const;

/**
 * Generates RIASEC interest profiles for a batch of courses and stores them in
 * course_riasec_profiles, which is what the backend recommendation function
 * reads. Admin only.
 */
export const generateCourseRiasecProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ courseIds: z.array(z.string().uuid()).min(1).max(25) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const url = getSupabaseUrl();
    const apiKey = getSupabasePublishableKey();
    if (!url) {
      return { ok: false as const, error: "The backend connection is not configured.", saved: 0 };
    }

    const admin = getSupabaseAdmin();
    const { data: courses, error } = await admin
      .from("courses")
      .select(
        "id, name, description, faculties:faculty_id ( name ), qualification_types:qualification_type_id ( name )",
      )
      .in("id", data.courseIds);
    if (error) throw error;
    if (!courses || courses.length === 0) {
      return { ok: false as const, error: "No matching courses were found.", saved: 0 };
    }

    const courseInputs = courses.map((c: any) => ({
      course_id: c.id as string,
      name: c.name as string,
      qualification: c.qualification_types?.name ?? null,
      faculty: c.faculties?.name ?? null,
      description: (c.description ?? "").slice(0, 600) || null,
    }));

    const token = getRequest()?.headers?.get("authorization") ?? "";

    let response: Response;
    try {
      response = await fetch(`${url}/functions/v1/course-interests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {}),
          ...(apiKey ? { apikey: apiKey } : {}),
        },
        body: JSON.stringify({ courses: courseInputs }),
      });
    } catch {
      return { ok: false as const, error: "We couldn't reach the AI service.", saved: 0 };
    }

    const raw = await response.text();
    if (response.status === 429) {
      return { ok: false as const, error: "The AI service is busy. Try again shortly.", saved: 0 };
    }
    if (!response.ok) {
      console.error("course-interests failed", response.status, raw.slice(0, 500));
      return { ok: false as const, error: "The AI service returned an error.", saved: 0 };
    }
    if (!raw) {
      return { ok: false as const, error: "The AI service returned nothing.", saved: 0 };
    }

    let parsed;
    try {
      parsed = responseSchema.safeParse(JSON.parse(raw));
    } catch {
      return { ok: false as const, error: "The AI service returned invalid JSON.", saved: 0 };
    }
    if (!parsed.success) {
      return { ok: false as const, error: "The AI service returned an unexpected shape.", saved: 0 };
    }

    const allowed = new Set(courses.map((c: any) => c.id as string));
    const rows = parsed.data.courses
      .filter((row) => allowed.has(row.course_id))
      .map((row) => {
        const total =
          DIMENSION_KEYS.reduce((sum, key) => sum + Math.max(0, Number(row[key]) || 0), 0) || 1;
        const scaled = Object.fromEntries(
          DIMENSION_KEYS.map((key) => [
            `${key}_score`,
            Math.round((Math.max(0, Number(row[key]) || 0) / total) * 100),
          ]),
        );
        return { course_id: row.course_id, ...scaled, notes: row.notes.slice(0, 400) };
      });

    if (rows.length === 0) {
      return { ok: false as const, error: "No usable profiles were generated.", saved: 0 };
    }

    const { error: upsertError } = await (admin as any)
      .from("course_riasec_profiles")
      .upsert(rows, { onConflict: "course_id" });
    if (upsertError) {
      return { ok: false as const, error: upsertError.message, saved: 0 };
    }

    return { ok: true as const, saved: rows.length, error: null };
  });

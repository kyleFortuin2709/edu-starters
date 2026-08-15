import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase-auth.middleware";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const SYSTEM_PROMPT = `You are a career-guidance analyst mapping South African tertiary courses onto the RIASEC (Holland Code) interest model.

For every course you are given, estimate how strongly the day-to-day study and work of that course draws on each of the six interest dimensions:
- realistic: hands-on, practical, technical, outdoor, machines, building
- investigative: research, analysis, science, problem solving
- artistic: creative, expressive, design, writing, performance
- social: teaching, helping, healing, working with people
- enterprising: leading, selling, persuading, business, entrepreneurship
- conventional: structure, data, records, accuracy, administration

Rules:
- Give each dimension a whole number 0-100. The six numbers for a course must add up to 100.
- Be decisive: a typical course has one or two clearly dominant dimensions.
- "notes" must be one short sentence explaining the profile in plain English.
- Return one entry per course, echoing the exact course_id you were given.
- Respond with JSON only, no markdown.`;

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

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, error: "The AI service is not configured yet.", saved: 0 };
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

    const prompt = courses
      .map((c: any) =>
        [
          `course_id: ${c.id}`,
          `name: ${c.name}`,
          `qualification: ${c.qualification_types?.name ?? "unknown"}`,
          `faculty: ${c.faculties?.name ?? "unknown"}`,
          `description: ${(c.description ?? "not available").slice(0, 600)}`,
        ].join("\n"),
      )
      .join("\n---\n");

    let response: Response;
    try {
      response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "course_riasec_profiles",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  courses: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        course_id: { type: "string" },
                        realistic: { type: "number" },
                        investigative: { type: "number" },
                        artistic: { type: "number" },
                        social: { type: "number" },
                        enterprising: { type: "number" },
                        conventional: { type: "number" },
                        notes: { type: "string" },
                      },
                      required: [
                        "course_id",
                        "realistic",
                        "investigative",
                        "artistic",
                        "social",
                        "enterprising",
                        "conventional",
                        "notes",
                      ],
                    },
                  },
                },
                required: ["courses"],
              },
            },
          },
        }),
      });
    } catch {
      return { ok: false as const, error: "We couldn't reach the AI service.", saved: 0 };
    }

    if (response.status === 429) {
      return { ok: false as const, error: "The AI service is busy. Try again shortly.", saved: 0 };
    }
    if (!response.ok) {
      return { ok: false as const, error: "The AI service returned an error.", saved: 0 };
    }

    const payload = (await response.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[] }
      | null;
    const raw = payload?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return { ok: false as const, error: "The AI service returned nothing.", saved: 0 };
    }

    let parsed;
    try {
      parsed = responseSchema.safeParse(JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")));
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

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase-auth.middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const SYSTEM_PROMPT = `You are the EduStarter course explainer for South African school leavers.

Given a course name, qualification, faculty and (optional) description, write:
1. "summary": 2-3 short sentences in plain, encouraging language explaining what this course is generally about and what a student would typically study.
2. "careers": exactly four realistic career paths this qualification could lead to in South Africa.

Rules:
- General guidance only. Never invent entry requirements, APS scores, fees, deadlines or statistics.
- Never promise admission or employment.
- Keep each career "title" short (max 5 words) and "description" one sentence.
- Respond with JSON only, no markdown.`;

export const getCourseOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        courseName: z.string().min(1).max(300),
        qualificationName: z.string().max(300).nullable().default(null),
        facultyName: z.string().max(300).nullable().default(null),
        description: z.string().max(2000).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, error: "The AI overview is not configured yet." };
    }

    const prompt = [
      `Course: ${data.courseName}`,
      `Qualification: ${data.qualificationName ?? "unknown"}`,
      `Faculty: ${data.facultyName ?? "unknown"}`,
      `Description from the institution: ${data.description ?? "not available"}`,
    ].join("\n");

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
              name: "course_overview",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  summary: { type: "string" },
                  careers: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["title", "description"],
                    },
                  },
                },
                required: ["summary", "careers"],
              },
            },
          },
        }),
      });
    } catch {
      return { ok: false as const, error: "We couldn't reach the AI service. Please try again." };
    }

    if (response.status === 429) {
      return { ok: false as const, error: "The AI service is busy right now. Please try again shortly." };
    }
    if (!response.ok) {
      return { ok: false as const, error: "We couldn't generate an overview right now." };
    }

    const payload = (await response.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[] }
      | null;
    const raw = payload?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return { ok: false as const, error: "The AI service didn't return an overview." };
    }

    const parsed = z
      .object({
        summary: z.string(),
        careers: z.array(z.object({ title: z.string(), description: z.string() })),
      })
      .safeParse(JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")));

    if (!parsed.success) {
      return { ok: false as const, error: "The AI service returned an unexpected answer." };
    }

    return {
      ok: true as const,
      summary: parsed.data.summary,
      careers: parsed.data.careers.slice(0, 5),
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase-auth.middleware";
import { parseCareers } from "@/lib/course-overview.shared";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase-env";

/**
 * Thin proxy to the project's own `course-ai` Supabase Edge Function.
 * That function owns the Gemini call, the JSON contract and the
 * `course_ai_overviews` cache — nothing here talks to an AI provider.
 */
export const getCourseOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        courseId: z.string().uuid(),
        courseName: z.string().min(1).max(300),
        qualificationName: z.string().max(300).nullable().default(null),
        facultyName: z.string().max(300).nullable().default(null),
        description: z.string().max(2000).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const url = getSupabaseUrl();
    const apiKey = getSupabasePublishableKey();
    if (!url) return { ok: false as const, error: "The backend connection is not configured." };

    const token = getRequest()?.headers?.get("authorization") ?? "";

    let response: Response;
    try {
      response = await fetch(`${url}/functions/v1/course-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {}),
          ...(apiKey ? { apikey: apiKey } : {}),
        },
        body: JSON.stringify({
          course_id: data.courseId,
          course_name: data.courseName,
          qualification_name: data.qualificationName,
          faculty_name: data.facultyName,
          description: data.description,
        }),
      });
    } catch {
      return { ok: false as const, error: "We couldn't reach the AI service. Please try again." };
    }

    const raw = await response.text();
    const body = (() => {
      try {
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        return {} as Record<string, unknown>;
      }
    })();

    if (response.status === 429) {
      return { ok: false as const, error: "The AI service is busy right now. Please try again shortly." };
    }
    if (!response.ok) {
      console.error("course-ai failed", response.status, raw.slice(0, 500));
      const message = typeof body["error"] === "string" ? body["error"] : "";
      return { ok: false as const, error: message || "We couldn't generate an overview right now." };
    }

    const summary = typeof body["summary"] === "string" ? body["summary"].trim() : "";
    const careers = parseCareers(body["careers"]);
    if (!summary || careers.length === 0) {
      return { ok: false as const, error: "The AI service returned an unexpected answer." };
    }

    return { ok: true as const, summary, careers: careers.slice(0, 5) };
  });

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase-auth.middleware";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase-env";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

/**
 * Thin proxy to the project's own `course-chat` Supabase Edge Function.
 * The system prompt and the Gemini call live in that function.
 */
export const askCourseAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        question: z.string().min(1).max(2000),
        context: z.string().min(1).max(12000),
        history: z.array(messageSchema).max(10).default([]),
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
      response = await fetch(`${url}/functions/v1/course-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {}),
          ...(apiKey ? { apikey: apiKey } : {}),
        },
        body: JSON.stringify({
          question: data.question,
          context: data.context,
          history: data.history,
        }),
      });
    } catch {
      return { ok: false as const, error: "We couldn't reach the AI advisor. Please try again." };
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
      return { ok: false as const, error: "The advisor is busy right now. Please try again in a moment." };
    }
    if (!response.ok) {
      console.error("course-chat failed", response.status, raw.slice(0, 500));
      const message = typeof body["error"] === "string" ? body["error"] : "";
      return { ok: false as const, error: message || "The advisor couldn't answer that right now. Please try again." };
    }

    const answer = typeof body["answer"] === "string" ? body["answer"].trim() : "";
    if (!answer) {
      return { ok: false as const, error: "The advisor didn't return an answer. Please try again." };
    }
    return { ok: true as const, answer };
  });

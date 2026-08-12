import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const SYSTEM_PROMPT = `You are the EduStarter Course Advisor. You help a South African student understand ONE specific university course and how their NSC results compare with it.

Absolute rules:
- The deterministic eligibility engine is the single source of truth. Its status and requirement outcomes are given to you in the context.
- Never calculate, re-calculate, change, or override APS scores, requirement outcomes or the eligibility status. Never invent course requirements, marks, deadlines, fees or statistics.
- If asked whether the student qualifies, EXPLAIN the given eligibility result in plain language — do not make a new decision.
- If something is not in the context, say you don't have that information and suggest checking the university's official prospectus.
- Never promise or imply admission. Eligibility is not a guarantee of acceptance.
- Course data may be labelled demo/example data; say so when it is.
- General course information and career paths are fine to discuss in general terms, clearly as general guidance.
- Be warm, encouraging, concise (max ~180 words) and use plain language. Use short paragraphs or bullets.`;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

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
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, error: "The AI advisor is not configured yet." };
    }

    let response: Response;
    try {
      response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "system", content: `Context for this course (the only data you may rely on):\n${data.context}` },
            ...data.history,
            { role: "user", content: data.question },
          ],
        }),
      });
    } catch {
      return { ok: false as const, error: "We couldn't reach the AI advisor. Please try again." };
    }

    if (response.status === 429) {
      return { ok: false as const, error: "The advisor is busy right now. Please try again in a moment." };
    }
    if (response.status === 402) {
      return { ok: false as const, error: "The AI advisor is temporarily unavailable. Please try again later." };
    }
    if (!response.ok) {
      return { ok: false as const, error: "The advisor couldn't answer that right now. Please try again." };
    }

    const payload = (await response.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[] }
      | null;
    const answer = payload?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return { ok: false as const, error: "The advisor didn't return an answer. Please try again." };
    }
    return { ok: true as const, answer };
  });

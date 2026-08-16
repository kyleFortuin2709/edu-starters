// supabase/functions/course-chat/index.ts
// AI course advisor. Explains an eligibility result that the deterministic
// engine already decided — it never recalculates anything.
const MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the EduStarter Course Advisor. You help a South African student understand ONE specific university course and how their NSC results compare with it.

Absolute rules:
- The deterministic eligibility engine is the single source of truth. Its status and requirement outcomes are given to you in the context.
- Never calculate, re-calculate, change, or override APS scores, requirement outcomes or the eligibility status. Never invent course requirements, marks, deadlines, fees or statistics.
- If asked whether the student qualifies, EXPLAIN the given eligibility result in plain language — do not make a new decision.
- If something is not in the context, say you don't have that information and suggest checking the university's official prospectus.
- Never promise or imply admission. Eligibility is not a guarantee of acceptance.
- General course information and career paths are fine to discuss in general terms, clearly as general guidance.
- Be warm, encouraging, concise (max ~180 words) and use plain language. Use short paragraphs or bullets.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const question = (body.question ?? "").toString().trim();
    const context = (body.context ?? "").toString().trim();
    if (!question || !context) return json({ error: "question and context are required" }, 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "The AI advisor is not configured yet." }, 500);

    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const contents = [
      ...history
        .filter((t: any) => t && typeof t.content === "string")
        .map((t: any) => ({
          role: t.role === "assistant" ? "model" : "user",
          parts: [{ text: t.content }],
        })),
      { role: "user", parts: [{ text: question }] },
    ];

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `Context for this course (the only data you may rely on):\n${context}` },
          ],
        },
        contents,
      }),
    });

    if (res.status === 429) return json({ error: "The advisor is busy right now." }, 429);
    if (!res.ok) {
      console.error("gemini error", res.status, (await res.text()).slice(0, 500));
      return json({ error: "The advisor couldn't answer that right now." }, 502);
    }

    const payload = await res.json();
    const answer = payload?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text ?? "")
      .join("")
      .trim();
    if (!answer) return json({ error: "The advisor didn't return an answer." }, 502);

    return json({ answer });
  } catch (error) {
    console.error(error);
    return json({ error: "Unexpected error." }, 500);
  }
});

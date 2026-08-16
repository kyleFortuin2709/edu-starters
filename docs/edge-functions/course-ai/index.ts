// supabase/functions/course-ai/index.ts
// Course explainer: one Gemini call returns summary + careers, cached in
// public.course_ai_overviews. Gemini is only called when no row exists.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the EduStarter course explainer for South African school leavers.

Given a course name, qualification, faculty and (optional) description, write:
1. "summary": 2-3 short sentences in plain, encouraging language explaining what this course is generally about and what a student would typically study.
2. "careers": exactly four realistic career paths this qualification could lead to in South Africa.

Rules:
- General guidance only. Never invent entry requirements, APS scores, fees, deadlines or statistics.
- Never promise admission or employment.
- Keep each career "title" short (max 5 words) and "description" one sentence.
- Respond with JSON only, no markdown.`;

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
    const courseId = body.course_id as string | undefined;
    const courseName = body.course_name as string | undefined;
    if (!courseId || !courseName) return json({ error: "course_id and course_name are required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1. Cached?
    const { data: cached } = await admin
      .from("course_ai_overviews")
      .select("summary, careers")
      .eq("course_id", courseId)
      .maybeSingle();
    if (cached?.summary && Array.isArray(cached.careers) && cached.careers.length > 0) {
      return json({ summary: cached.summary, careers: cached.careers, cached: true });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "The AI service is not configured yet." }, 500);

    const prompt = [
      `Course: ${courseName}`,
      `Qualification: ${body.qualification_name ?? "unknown"}`,
      `Faculty: ${body.faculty_name ?? "unknown"}`,
      `Description from the institution: ${body.description ?? "not available"}`,
    ].join("\n");

    // 2. Generate.
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              summary: { type: "STRING" },
              careers: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: { title: { type: "STRING" }, description: { type: "STRING" } },
                  required: ["title", "description"],
                },
              },
            },
            required: ["summary", "careers"],
          },
        },
      }),
    });

    if (res.status === 429) return json({ error: "The AI service is busy right now." }, 429);
    if (!res.ok) {
      console.error("gemini error", res.status, (await res.text()).slice(0, 500));
      return json({ error: "We couldn't generate an overview right now." }, 502);
    }

    const payload = await res.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) return json({ error: "The AI service didn't return an overview." }, 502);

    let parsed: { summary?: string; careers?: { title: string; description: string }[] };
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      return json({ error: "The AI service returned an unexpected answer." }, 502);
    }
    const summary = (parsed.summary ?? "").trim();
    const careers = (parsed.careers ?? [])
      .filter((c) => c && typeof c.title === "string" && typeof c.description === "string")
      .slice(0, 5);
    if (!summary || careers.length === 0) {
      return json({ error: "The AI service returned an unexpected answer." }, 502);
    }

    // 3. Cache.
    const { error: writeError } = await admin.from("course_ai_overviews").upsert(
      {
        course_id: courseId,
        summary,
        careers,
        model: MODEL,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "course_id" },
    );
    if (writeError) console.error("cache write failed", writeError);

    return json({ summary, careers, cached: false });
  } catch (error) {
    console.error(error);
    return json({ error: "Unexpected error." }, 500);
  }
});

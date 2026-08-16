// supabase/functions/course-interests/index.ts
// Batch RIASEC interest profiles for courses. Returns raw scores; the app
// normalises them and writes course_riasec_profiles.
const MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const DIMENSIONS = ["realistic", "investigative", "artistic", "social", "enterprising", "conventional"];

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
    const courses = Array.isArray(body.courses) ? body.courses.slice(0, 25) : [];
    if (courses.length === 0) return json({ error: "courses are required" }, 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "The AI service is not configured yet." }, 500);

    const prompt = courses
      .map((c: any) =>
        [
          `course_id: ${c.course_id}`,
          `name: ${c.name}`,
          `qualification: ${c.qualification ?? "unknown"}`,
          `faculty: ${c.faculty ?? "unknown"}`,
          `description: ${c.description ?? "not available"}`,
        ].join("\n"),
      )
      .join("\n---\n");

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
              courses: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    course_id: { type: "STRING" },
                    ...Object.fromEntries(DIMENSIONS.map((d) => [d, { type: "NUMBER" }])),
                    notes: { type: "STRING" },
                  },
                  required: ["course_id", ...DIMENSIONS, "notes"],
                },
              },
            },
            required: ["courses"],
          },
        },
      }),
    });

    if (res.status === 429) return json({ error: "The AI service is busy." }, 429);
    if (!res.ok) {
      console.error("gemini error", res.status, (await res.text()).slice(0, 500));
      return json({ error: "The AI service returned an error." }, 502);
    }

    const payload = await res.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) return json({ error: "The AI service returned nothing." }, 502);

    try {
      return json(JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")));
    } catch {
      return json({ error: "The AI service returned invalid JSON." }, 502);
    }
  } catch (error) {
    console.error(error);
    return json({ error: "Unexpected error." }, 500);
  }
});

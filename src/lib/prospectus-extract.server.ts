import type { Database } from "@/integrations/supabase/types";

/**
 * Server-only prospectus extraction helpers.
 *
 * The AI reads a prospectus PDF and returns STRUCTURED data only. Nothing here
 * writes to the live catalogue: results are always written to the staging
 * tables for human review.
 */

export const EXTRACTION_MODEL = "google/gemini-3.6-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_BYTES = 20 * 1024 * 1024;

export type ExtractedCourse = {
  name: string;
  code: string | null;
  faculty_name: string | null;
  qualification_name: string | null;
  description: string | null;
  duration_years: number | null;
  aps_requirement: number | null;
  application_url: string | null;
  subject_requirements: { subject: string; minimum: string | null; note: string | null }[];
  requirements_text: string | null;
  source_page: number | null;
  confidence: "high" | "medium" | "low";
  review_flags: string[];
};

export type ExtractionResult = {
  university_name: string | null;
  academic_year: string | null;
  aps_methodology_text: string | null;
  document_flags: string[];
  courses: ExtractedCourse[];
  proposed_aps: ProposedAps | null;
  proposed_institution: ProposedInstitution | null;
};

/**
 * Institution details the document states about itself. A PROPOSAL only: a
 * reviewer creates or links the real institution record by hand.
 */
export type ProposedInstitution = {
  name: string | null;
  short_name: string | null;
  institution_type: string | null;
  city: string | null;
  province: string | null;
  website_url: string | null;
  application_url: string | null;
  notes: string[];
};

/**
 * A calculation rule the AI believes the document describes. It is a PROPOSAL
 * only: it is never written to the APS rule tables until an administrator
 * creates it, and even then it stays `unverified` until explicitly confirmed.
 */
export type ProposedAps = {
  name: string | null;
  counting_subject_count: number | null;
  bands: { min_percentage: number; max_percentage: number; points: number; label: string | null }[];
  notes: string[];
};

const SYSTEM_PROMPT = `You extract structured university prospectus data for a South African admissions tool.

Rules:
- Only report information that is actually present in the document. Never invent, infer or complete missing values.
- If a value is missing, unclear, or ambiguous, use null and add a short human-readable note to review_flags for that course (or document_flags for document-level issues).
- Do not produce advice, recommendations, marketing copy or student-facing guidance. Structured facts only.
- Copy APS requirements and subject minimums exactly as stated. If the document expresses a requirement in a way that does not fit the fields, put the verbatim wording in requirements_text and flag it.
- source_page is the printed/PDF page number where the course was found, when identifiable.
- confidence reflects how clearly the document states the course's requirements.
- If the document describes how APS / admission points are calculated, copy that methodology verbatim into aps_methodology_text. Otherwise null.
- If the document contains a percentage-to-points table for APS, put it in proposed_aps.bands exactly as printed (one entry per band). If no such table exists, set proposed_aps to null. Never invent bands.
- proposed_aps.counting_subject_count is how many subjects the document says are counted, or null.
- Add anything unclear about the calculation to proposed_aps.notes.
- In proposed_institution, copy what the document states about the institution itself: full name, short name/abbreviation, institution type (e.g. university, university of technology, TVET college), city, province, website and application URL. Use null for anything not stated and add a note to proposed_institution.notes.

Respond with JSON only, matching exactly:
{"university_name":string|null,"academic_year":string|null,"aps_methodology_text":string|null,"document_flags":string[],"proposed_institution":{"name":string|null,"short_name":string|null,"institution_type":string|null,"city":string|null,"province":string|null,"website_url":string|null,"application_url":string|null,"notes":string[]}|null,"proposed_aps":{"name":string|null,"counting_subject_count":number|null,"bands":[{"min_percentage":number,"max_percentage":number,"points":number,"label":string|null}],"notes":string[]}|null,"courses":[{"name":string,"code":string|null,"faculty_name":string|null,"qualification_name":string|null,"description":string|null,"duration_years":number|null,"aps_requirement":number|null,"application_url":string|null,"subject_requirements":[{"subject":string,"minimum":string|null,"note":string|null}],"requirements_text":string|null,"source_page":number|null,"confidence":"high"|"medium"|"low","review_flags":string[]}]}`;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function parseJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((v): v is string => Boolean(v));
}

function normaliseCourse(raw: unknown): ExtractedCourse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = asString(r["name"]);
  if (!name) return null;

  const flags = asStringList(r["review_flags"]);
  const subjects = Array.isArray(r["subject_requirements"])
    ? (r["subject_requirements"] as unknown[])
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const o = s as Record<string, unknown>;
          const subject = asString(o["subject"]);
          if (!subject) return null;
          return { subject, minimum: asString(o["minimum"]), note: asString(o["note"]) };
        })
        .filter((s): s is ExtractedCourse["subject_requirements"][number] => s !== null)
    : [];

  const confidenceRaw = asString(r["confidence"]);
  const confidence: ExtractedCourse["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : "low";

  const aps = asNumber(r["aps_requirement"]);
  const course: ExtractedCourse = {
    name,
    code: asString(r["code"]),
    faculty_name: asString(r["faculty_name"]),
    qualification_name: asString(r["qualification_name"]),
    description: asString(r["description"]),
    duration_years: asNumber(r["duration_years"]),
    aps_requirement: aps != null && aps >= 0 && aps <= 60 ? Math.round(aps) : null,
    application_url: asString(r["application_url"]),
    subject_requirements: subjects,
    requirements_text: asString(r["requirements_text"]),
    source_page: asNumber(r["source_page"]),
    confidence,
    review_flags: flags,
  };

  if (aps != null && course.aps_requirement == null) {
    course.review_flags.push(`APS value "${String(r["aps_requirement"])}" was outside 0–60 and was not captured.`);
  }
  if (course.aps_requirement == null) course.review_flags.push("No APS requirement found — confirm by hand.");
  if (subjects.length === 0 && !course.requirements_text)
    course.review_flags.push("No subject requirements found — confirm by hand.");
  if (!course.qualification_name) course.review_flags.push("Qualification type missing.");
  if (!course.faculty_name) course.review_flags.push("Faculty missing.");
  if (course.source_page == null) course.review_flags.push("Source page unknown.");

  return course;
}

function normaliseProposedAps(raw: unknown): ProposedAps | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const bands = Array.isArray(r["bands"])
    ? (r["bands"] as unknown[])
        .map((b) => {
          if (!b || typeof b !== "object") return null;
          const o = b as Record<string, unknown>;
          const min = asNumber(o["min_percentage"]);
          const max = asNumber(o["max_percentage"]);
          const points = asNumber(o["points"]);
          if (min == null || max == null || points == null) return null;
          return { min_percentage: min, max_percentage: max, points, label: asString(o["label"]) };
        })
        .filter((b): b is ProposedAps["bands"][number] => b !== null)
    : [];
  const notes = asStringList(r["notes"]);
  if (bands.length === 0 && notes.length === 0) return null;
  return {
    name: asString(r["name"]),
    counting_subject_count: asNumber(r["counting_subject_count"]),
    bands,
    notes,
  };
}

function normalise(raw: unknown): ExtractionResult {
  return normaliseResult(raw);
}

function normaliseProposedInstitution(
  raw: unknown,
  fallbackName: string | null,
): ProposedInstitution | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const institution: ProposedInstitution = {
    name: asString(r["name"]) ?? fallbackName,
    short_name: asString(r["short_name"]),
    institution_type: asString(r["institution_type"]),
    city: asString(r["city"]),
    province: asString(r["province"]),
    website_url: asString(r["website_url"]),
    application_url: asString(r["application_url"]),
    notes: asStringList(r["notes"]),
  };
  const hasAnything = Object.entries(institution).some(([key, value]) =>
    key === "notes" ? (value as string[]).length > 0 : Boolean(value),
  );
  return hasAnything ? institution : null;
}

function normaliseResult(raw: unknown): ExtractionResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const courses = Array.isArray(r["courses"])
    ? (r["courses"] as unknown[]).map(normaliseCourse).filter((c): c is ExtractedCourse => c !== null)
    : [];
  const documentFlags = asStringList(r["document_flags"]);
  if (courses.length === 0) documentFlags.push("No courses could be extracted from this document.");
  const proposedAps = normaliseProposedAps(r["proposed_aps"]);
  if (!proposedAps)
    documentFlags.push("No APS calculation table was found — any calculation rule must be captured by hand.");
  const proposedInstitution = normaliseProposedInstitution(r["proposed_institution"], asString(r["university_name"]));
  if (!proposedInstitution?.name)
    documentFlags.push("The institution's name could not be read — capture the institution by hand before reviewing courses.");
  return {
    university_name: asString(r["university_name"]),
    academic_year: asString(r["academic_year"]),
    aps_methodology_text: asString(r["aps_methodology_text"]),
    document_flags: documentFlags,
    courses,
    proposed_aps: proposedAps,
    proposed_institution: proposedInstitution,
  };
}

export type ProspectusRow = Database["public"]["Tables"]["prospectus_documents"]["Row"];

export async function extractFromPdf(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType?: string;
}): Promise<ExtractionResult> {
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new Error("This document is larger than 20 MB, which is too big to analyse.");
  }
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI extraction is not configured for this project.");

  const dataUrl = `data:${input.mimeType || "application/pdf"};base64,${toBase64(input.bytes)}`;

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract every course/programme you can find in this prospectus, plus the APS calculation methodology if it is described. Flag anything missing or ambiguous instead of guessing.",
            },
            { type: "file", file: { filename: input.fileName, file_data: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (response.status === 429) throw new Error("The AI service is busy right now. Please try again shortly.");
  if (response.status === 402) throw new Error("AI credits are exhausted for this workspace.");
  if (!response.ok) {
    const detail = await response.text();
    console.error("prospectus extraction failed", response.status, detail.slice(0, 500));
    throw new Error("The document could not be analysed. Please try again.");
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  try {
    return normalise(parseJson(content));
  } catch {
    throw new Error("The AI returned data we couldn't read. Please try again.");
  }
}
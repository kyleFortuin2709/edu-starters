import { supabase } from "@/integrations/supabase/client";

/**
 * Prospectus ingestion + staging data access.
 *
 * Staged data lives in its own tables and NEVER touches the live catalogue.
 * All access is admin-only, enforced by RLS.
 */

export const PROSPECTUS_BUCKET = "prospectuses";

export type IngestionStatus =
  | "uploaded"
  | "processing"
  | "review_required"
  | "approved"
  | "published";

export const INGESTION_STATUSES: { value: IngestionStatus; label: string }[] = [
  { value: "uploaded", label: "Uploaded" },
  { value: "processing", label: "Processing" },
  { value: "review_required", label: "Review required" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
];

export function ingestionStatusLabel(status: IngestionStatus): string {
  return INGESTION_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export type ProspectusDocument = {
  id: string;
  university_id: string | null;
  aps_rule_id: string | null;
  title: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  academic_year: string | null;
  status: IngestionStatus;
  page_count: number | null;
  notes: string | null;
  error_message: string | null;
  extracted_at: string | null;
  extraction_model: string | null;
  aps_methodology_text: string | null;
  extraction_payload: {
    university_name?: string | null;
    academic_year?: string | null;
    document_flags?: string[];
    course_count?: number;
    proposed_aps?: ProposedApsPayload | null;
    proposed_institution?: ProposedInstitutionPayload | null;
  } | null;
  created_at: string;
  updated_at: string;
  universities: { id: string; name: string } | null;
};

export type ProposedApsPayload = {
  name?: string | null;
  counting_subject_count?: number | null;
  bands?: { min_percentage: number; max_percentage: number; points: number; label: string | null }[];
  notes?: string[];
};

export type ProposedInstitutionPayload = {
  name?: string | null;
  short_name?: string | null;
  institution_type?: string | null;
  city?: string | null;
  province?: string | null;
  website_url?: string | null;
  application_url?: string | null;
  notes?: string[];
};

/**
 * The extractor is external, so its JSON shape varies. These normalisers read
 * whichever key names it used (and fall back to document-level fields) so the
 * review cards always pre-populate with whatever was found.
 */
type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.replace(/[^\d.]/g, "")) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function pick(source: AnyRecord | null, keys: string[]): unknown {
  if (!source) return undefined;
  for (const key of keys) if (source[key] != null) return source[key];
  return undefined;
}

export function proposedInstitution(doc: ProspectusDocument): ProposedInstitutionPayload | null {
  const payload = asRecord(doc.extraction_payload) ?? {};
  const raw =
    asRecord(pick(payload, ["proposed_institution", "institution", "university", "provider"])) ?? {};
  const name =
    str(pick(raw, ["name", "institution_name", "university_name", "full_name"])) ??
    str(pick(payload, ["university_name", "institution_name"]));
  const result: ProposedInstitutionPayload = {
    name,
    short_name: str(pick(raw, ["short_name", "abbreviation", "acronym"])),
    institution_type: str(pick(raw, ["institution_type", "type"])),
    city: str(pick(raw, ["city", "town", "campus_city"])),
    province: str(pick(raw, ["province", "region"])),
    website_url: str(pick(raw, ["website_url", "website", "url"])),
    application_url: str(pick(raw, ["application_url", "apply_url", "applications_url"])),
    notes: Array.isArray(raw['notes']) ? (raw['notes'] as string[]) : [],
  };
  return result.name || result.city || result.province || result.short_name ? result : null;
}

export function proposedAps(doc: ProspectusDocument): ProposedApsPayload | null {
  const payload = asRecord(doc.extraction_payload) ?? {};
  const raw =
    asRecord(
      pick(payload, ["proposed_aps", "aps", "aps_rule", "aps_calculation", "aps_methodology"]),
    ) ?? {};
  const bandsRaw = pick(raw, ["bands", "point_bands", "points_table", "table"]) ??
    pick(payload, ["aps_bands", "aps_point_bands", "points_table"]);
  const bands = Array.isArray(bandsRaw)
    ? bandsRaw
        .map((entry) => {
          const b = asRecord(entry);
          if (!b) return null;
          const min = num(pick(b, ["min_percentage", "min", "from", "percentage_from", "lower"]));
          const max = num(pick(b, ["max_percentage", "max", "to", "percentage_to", "upper"]));
          const points = num(pick(b, ["points", "aps_points", "value", "score"]));
          if (min == null && max == null && points == null) return null;
          return {
            min_percentage: min ?? 0,
            max_percentage: max ?? 100,
            points: points ?? 0,
            label: str(pick(b, ["label", "name", "level", "description"])),
          };
        })
        .filter((b): b is NonNullable<typeof b> => b != null)
    : [];
  const notes = pick(raw, ["notes", "ambiguities", "flags"]);
  const result: ProposedApsPayload = {
    name: str(pick(raw, ["name", "rule_name", "title"])),
    counting_subject_count: num(
      pick(raw, ["counting_subject_count", "subjects_counted", "subject_count"]),
    ),
    bands,
    notes: Array.isArray(notes) ? (notes as string[]) : [],
  };
  return result.name || result.counting_subject_count != null || bands.length > 0 || result.notes?.length
    ? result
    : null;
}

/** APS methodology text, whether the extractor stored it in a column or the payload. */
export function apsMethodologyText(doc: ProspectusDocument): string | null {
  const payload = asRecord(doc.extraction_payload) ?? {};
  return (
    doc.aps_methodology_text ??
    str(pick(payload, ["aps_methodology_text", "aps_methodology", "methodology"]))
  );
}

const PROSPECTUS_SELECT = `
  id, university_id, aps_rule_id, title, file_name, storage_path, file_size, academic_year,
  status, page_count, notes, error_message, created_at, updated_at,
  extracted_at, extraction_model, aps_methodology_text, extraction_payload,
  universities:university_id ( id, name )
`;

export type StagedCourse = {
  id: string;
  prospectus_id: string;
  university_id: string | null;
  faculty_name: string | null;
  qualification_name: string | null;
  name: string;
  code: string | null;
  description: string | null;
  duration_years: number | null;
  aps_requirement: number | null;
  application_url: string | null;
  requirements_text: string | null;
  source_page: number | null;
  status: IngestionStatus;
  review_notes: string | null;
  published_course_id: string | null;
  extracted_payload: {
    source?: string;
    model?: string;
    extracted_at?: string;
    confidence?: "high" | "medium" | "low";
    review_flags?: string[];
    subject_requirements?: { subject: string; minimum: string | null; note: string | null }[];
  } | null;
  created_at: string;
  updated_at: string;
};

const STAGED_SELECT = `
  id, prospectus_id, university_id, faculty_name, qualification_name, name, code,
  description, duration_years, aps_requirement, application_url, requirements_text,
  source_page, status, review_notes, published_course_id, extracted_payload,
  created_at, updated_at
`;

export async function fetchProspectuses(): Promise<ProspectusDocument[]> {
  const { data, error } = await supabase
    .from("prospectus_documents")
    .select(PROSPECTUS_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProspectusDocument[];
}

export async function fetchProspectus(id: string): Promise<ProspectusDocument | null> {
  const { data, error } = await supabase
    .from("prospectus_documents")
    .select(PROSPECTUS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as ProspectusDocument | null;
}

export type ProspectusUpload = {
  file: File;
  title: string;
  universityId: string | null;
  academicYear: string | null;
  notes: string | null;
};

export async function uploadProspectus(input: ProspectusUpload): Promise<ProspectusDocument> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${userId ?? "unknown"}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(PROSPECTUS_BUCKET)
    .upload(storagePath, input.file, { contentType: input.file.type || "application/pdf" });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("prospectus_documents")
    .insert({
      title: input.title,
      file_name: input.file.name,
      storage_path: storagePath,
      file_size: input.file.size,
      university_id: input.universityId,
      academic_year: input.academicYear,
      notes: input.notes,
      uploaded_by: userId,
      status: "uploaded",
    })
    .select(PROSPECTUS_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as ProspectusDocument;
}

export async function updateProspectus(
  id: string,
  patch: Partial<
    Pick<
      ProspectusDocument,
      "title" | "status" | "notes" | "academic_year" | "university_id" | "page_count" | "error_message"
    >
  >,
): Promise<void> {
  const { error } = await supabase.from("prospectus_documents").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProspectus(doc: ProspectusDocument): Promise<void> {
  const { error } = await supabase.from("prospectus_documents").delete().eq("id", doc.id);
  if (error) throw error;
  await supabase.storage.from(PROSPECTUS_BUCKET).remove([doc.storage_path]);
}

export async function createProspectusFileUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PROSPECTUS_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function fetchStagedCourses(prospectusId: string): Promise<StagedCourse[]> {
  const { data, error } = await supabase
    .from("staged_courses")
    .select(STAGED_SELECT)
    .eq("prospectus_id", prospectusId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as StagedCourse[];
}

export async function fetchStagedCourse(id: string): Promise<StagedCourse | null> {
  const { data, error } = await supabase
    .from("staged_courses")
    .select(STAGED_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as StagedCourse | null;
}

export type StagedCoursePatch = Partial<
  Pick<
    StagedCourse,
    | "name"
    | "code"
    | "description"
    | "duration_years"
    | "aps_requirement"
    | "application_url"
    | "faculty_name"
    | "qualification_name"
    | "requirements_text"
    | "source_page"
    | "review_notes"
    | "status"
    | "university_id"
  >
>;

export async function createStagedCourse(
  prospectusId: string,
  values: StagedCoursePatch & { name: string; university_id?: string | null },
): Promise<StagedCourse> {
  const { data, error } = await supabase
    .from("staged_courses")
    .insert({ ...values, prospectus_id: prospectusId, status: values.status ?? "review_required" })
    .select(STAGED_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as StagedCourse;
}

export async function updateStagedCourse(id: string, patch: StagedCoursePatch): Promise<void> {
  const { error } = await supabase.from("staged_courses").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteStagedCourse(id: string): Promise<void> {
  const { error } = await supabase.from("staged_courses").delete().eq("id", id);
  if (error) throw error;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

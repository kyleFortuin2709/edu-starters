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

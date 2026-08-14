import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Frontend glue for the existing `extract-matric-certificate` Edge Function.
 * No AI/OCR happens here: we upload, invoke, then poll the backend's own
 * staging tables (`staged_matric_documents` / `staged_matric_subjects`).
 */

// The staging tables live outside the generated types, so use an untyped view.
const db = supabase as unknown as SupabaseClient;

export const BUCKET = "matric-documents";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_MIME = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const ACCEPTED_EXT = ["jpg", "jpeg", "png", "pdf"];

export type DocumentStatus = "processing" | "review_required" | "failed";

export type ExtractedSubject = {
  id: string;
  subject_name_raw: string | null;
  percentage: number | null;
  achievement_level: number | null;
  is_life_orientation: boolean | null;
  confidence: number | null;
  subject_id: string | null;
  confirmed: boolean | null;
};

export function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const typeOk = ACCEPTED_MIME.includes(file.type.toLowerCase()) || ACCEPTED_EXT.includes(ext);
  if (!typeOk) return "That file type isn't supported. Please upload a JPG, PNG or PDF.";
  if (file.size > MAX_FILE_BYTES) return "That file is larger than 20 MB. Please upload a smaller file.";
  if (file.size === 0) return "That file appears to be empty. Please choose another one.";
  return null;
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-60);
  return `${Date.now()}-${cleaned || "results"}`;
}

/** Uploads to `<student UUID>/<filename>` in the matric-documents bucket. */
export async function uploadResultsDocument(userId: string, file: File): Promise<string> {
  const path = `${userId}/${safeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    ...(file.type ? { contentType: file.type } : {}),
    upsert: false,
  });
  if (error) {
    console.error("matric upload failed", error);
    throw new Error("We couldn't upload your document. Please check your connection and try again.");
  }
  return path;
}

/** Kicks off extraction; returns the staging document id to poll. */
export async function startExtraction(userId: string, filePath: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("extract-matric-certificate", {
    body: { file_path: filePath, student_id: userId },
  });
  if (error) {
    console.error("extract-matric-certificate failed", error);
    throw new Error("We couldn't start reading your document. Please try again in a moment.");
  }
  const body = (data ?? {}) as Record<string, unknown>;
  const id = body["document_id"] ?? body["extraction_id"];
  if (typeof id !== "string" || !id) {
    throw new Error("We couldn't start reading your document. Please try again in a moment.");
  }
  return id;
}

export type DocumentState = { status: DocumentStatus; errorMessage: string | null };

export async function fetchDocumentState(documentId: string): Promise<DocumentState> {
  const { data, error } = await db
    .from("staged_matric_documents")
    .select("status, error_message")
    .eq("id", documentId)
    .maybeSingle();
  if (error) {
    console.error("staged document poll failed", error);
    throw new Error("We lost track of your document while it was being read. Please try again.");
  }
  if (!data) throw new Error("We couldn't find that upload any more. Please try again.");
  const row = data as { status: string | null; error_message: string | null };
  return {
    status: (row.status ?? "processing") as DocumentStatus,
    errorMessage: row.error_message ?? null,
  };
}

export async function fetchExtractedSubjects(documentId: string): Promise<ExtractedSubject[]> {
  const { data, error } = await db
    .from("staged_matric_subjects")
    .select(
      "id, subject_name_raw, percentage, achievement_level, is_life_orientation, confidence, subject_id, confirmed",
    )
    .eq("document_id", documentId);
  if (error) {
    console.error("staged subjects fetch failed", error);
    throw new Error("We read your document but couldn't load the subjects. Please try again.");
  }
  return (data ?? []) as ExtractedSubject[];
}
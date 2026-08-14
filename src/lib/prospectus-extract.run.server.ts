import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { extractFromPdf, EXTRACTION_MODEL, type ExtractionResult } from "./prospectus-extract.server";

type Client = SupabaseClient<Database>;

export type ExtractionRunResult = {
  stagedCount: number;
  documentFlags: string[];
  apsMethodologyFound: boolean;
};

export async function runExtractionForProspectus(input: {
  prospectusId: string;
  userId: string;
  supabase: Client;
}): Promise<ExtractionRunResult> {
  const { supabase, prospectusId, userId } = input;

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleError) throw new Error("We couldn't verify your admin access.");
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });

  const { data: doc, error: docError } = await supabase
    .from("prospectus_documents")
    .select("id, title, file_name, storage_path, university_id")
    .eq("id", prospectusId)
    .maybeSingle();
  if (docError) throw new Error("We couldn't load that prospectus.");
  if (!doc) throw new Error("That prospectus no longer exists.");

  const { getSupabaseAdmin } = await import("./supabase-admin.server");
  const supabaseAdmin = getSupabaseAdmin();

  await supabase
    .from("prospectus_documents")
    .update({ status: "processing", error_message: null })
    .eq("id", prospectusId);

  try {
    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from("prospectuses")
      .download(doc.storage_path);
    if (downloadError || !file) throw new Error("We couldn't open the uploaded file.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result: ExtractionResult = await extractFromPdf({
      bytes,
      fileName: doc.file_name,
      mimeType: file.type || "application/pdf",
    });

    if (result.courses.length > 0) {
      const rows = result.courses.map((course) => ({
        prospectus_id: prospectusId,
        university_id: doc.university_id,
        name: course.name,
        code: course.code,
        faculty_name: course.faculty_name,
        qualification_name: course.qualification_name,
        description: course.description,
        duration_years: course.duration_years,
        aps_requirement: course.aps_requirement,
        application_url: course.application_url,
        requirements_text: course.requirements_text,
        source_page: course.source_page,
        status: "review_required" as const,
        review_notes:
          course.review_flags.length > 0
            ? `Needs human review:\n- ${course.review_flags.join("\n- ")}`
            : null,
        extracted_payload: {
          source: "ai_extraction",
          model: EXTRACTION_MODEL,
          extracted_at: new Date().toISOString(),
          confidence: course.confidence,
          review_flags: course.review_flags,
          subject_requirements: course.subject_requirements,
        },
      }));

      const { error: insertError } = await supabaseAdmin.from("staged_courses").insert(rows);
      if (insertError) throw new Error("The extracted courses couldn't be staged.");
    }

    await supabase
      .from("prospectus_documents")
      .update({
        status: "review_required",
        extracted_at: new Date().toISOString(),
        extraction_model: EXTRACTION_MODEL,
        aps_methodology_text: result.aps_methodology_text,
        extraction_payload: {
          university_name: result.university_name,
          academic_year: result.academic_year,
          document_flags: result.document_flags,
          course_count: result.courses.length,
          proposed_aps: result.proposed_aps,
          proposed_institution: result.proposed_institution,
        },
        error_message: null,
      })
      .eq("id", prospectusId);

    return {
      stagedCount: result.courses.length,
      documentFlags: result.document_flags,
      apsMethodologyFound: Boolean(result.aps_methodology_text),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed.";
    await supabase
      .from("prospectus_documents")
      .update({ status: "review_required", error_message: message })
      .eq("id", prospectusId);
    throw error;
  }
}
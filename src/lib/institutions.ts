import { supabase } from "@/integrations/supabase/client";
import type { PublicationStatus } from "./admin";

/**
 * Institution-level registration for the prospectus review workflow.
 *
 * A prospectus belongs to ONE institution. Reviewers confirm (or create) that
 * institution first; every staged course from the document then inherits the
 * link, so the "missing university link" gap is solved once per document
 * instead of once per course. Nothing here is specific to a named university.
 */

export type Institution = {
  id: string;
  province_id: string;
  code: string;
  name: string;
  short_name: string | null;
  city: string | null;
  description: string | null;
  website_url: string | null;
  application_url: string | null;
  is_active: boolean;
  is_demo: boolean;
  publication_status: PublicationStatus;
};

const INSTITUTION_SELECT = `
  id, province_id, code, name, short_name, city, description, website_url,
  application_url, is_active, is_demo, publication_status
`;

export type InstitutionInput = {
  name: string;
  short_name: string | null;
  code: string | null;
  city: string | null;
  province_id: string;
  description: string | null;
  website_url: string | null;
  application_url: string | null;
};

function slugCode(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.map((w) => w[0]).join("");
  return (initials.length >= 2 ? initials : words.join("")).slice(0, 12) || "INST";
}

export async function fetchInstitution(id: string): Promise<Institution | null> {
  const { data, error } = await supabase
    .from("universities")
    .select(INSTITUTION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as Institution | null;
}

/** Institutions are created as DRAFT: students only see them once published. */
export async function createInstitution(input: InstitutionInput): Promise<Institution> {
  const base = input.code?.trim().toUpperCase() || slugCode(input.name);
  const { data: clashes } = await supabase.from("universities").select("code").ilike("code", `${base}%`);
  const taken = new Set((clashes ?? []).map((c) => c.code.toUpperCase()));
  let code = base;
  let n = 2;
  while (taken.has(code)) code = `${base}_${n++}`;

  const { data, error } = await supabase
    .from("universities")
    .insert({
      province_id: input.province_id,
      code,
      name: input.name.trim(),
      short_name: input.short_name?.trim() || null,
      city: input.city?.trim() || null,
      description: input.description?.trim() || null,
      website_url: input.website_url?.trim() || null,
      application_url: input.application_url?.trim() || null,
      is_active: true,
      is_demo: false,
      publication_status: "draft",
    })
    .select(INSTITUTION_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as Institution;
}

export type InstitutionPatch = Partial<
  Pick<
    Institution,
    | "name"
    | "short_name"
    | "city"
    | "province_id"
    | "description"
    | "website_url"
    | "application_url"
    | "is_active"
    | "publication_status"
  >
>;

export async function updateInstitution(id: string, patch: InstitutionPatch): Promise<void> {
  const { error } = await supabase.from("universities").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Point the document AND every staged course it produced at one institution.
 * Returns how many staged rows were back-filled.
 */
export async function linkProspectusInstitution(
  prospectusId: string,
  universityId: string,
): Promise<number> {
  const { error } = await supabase
    .from("prospectus_documents")
    .update({ university_id: universityId })
    .eq("id", prospectusId);
  if (error) throw error;

  const { data, error: stagedError } = await supabase
    .from("staged_courses")
    .update({ university_id: universityId })
    .eq("prospectus_id", prospectusId)
    .neq("status", "published")
    .select("id");
  if (stagedError) throw stagedError;
  return data?.length ?? 0;
}

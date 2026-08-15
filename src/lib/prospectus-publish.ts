import { supabase } from "@/integrations/supabase/client";
import { proposedAps, type ProspectusDocument, type StagedCourse } from "./prospectus";

/**
 * Staging -> live promotion.
 *
 * Nothing in here is specific to a named university, faculty or course: the
 * live records are derived entirely from what a human reviewer approved in the
 * staging tables. Staged rows are never mutated into live rows — a new live
 * course is created and the staged row keeps a pointer to it.
 */

export type MissingItem = { label: string; blocking: boolean };

/**
 * Typical South African qualification durations. Used only when the document
 * itself never states a duration — the guess is recorded in course metadata.
 */
const DURATION_PATTERNS: { test: RegExp; years: number }[] = [
  { test: /\b(higher certificate|certificate)\b/i, years: 1 },
  { test: /\b(advanced diploma|postgraduate diploma|pgdip|honours|hons|b[.\s]?tech)\b/i, years: 1 },
  { test: /\b(masters?|m\.?\s?(a|sc|com|ed|phil)\b)/i, years: 2 },
  { test: /\b(doctor of philosophy|phd|dphil|doctoral)\b/i, years: 3 },
  { test: /\b(national diploma|diploma)\b/i, years: 3 },
  { test: /\b(mbchb|mb ch b|bachelor of medicine)\b/i, years: 6 },
  { test: /\b(bachelor of architecture|b[.\s]?arch|bvsc|veterinary)\b/i, years: 5 },
  { test: /\b(bachelor of (engineering|pharmacy)|b[.\s]?eng|beng|bpharm|llb|bachelor of laws)\b/i, years: 4 },
  { test: /\b(bachelor of (education|nursing|accounting|social work)|b[.\s]?ed|bcur|bsw)\b/i, years: 4 },
  { test: /\b(bachelor|degree|b[.\s]?(a|sc|com|admin|is|th|lis)\b|^b[a-z]{1,4}$)/i, years: 3 },
];

/** Pull an explicit duration out of free text such as "3-year programme". */
function durationFromText(text: string | null): number | null {
  if (!text) return null;
  const match =
    text.match(/(\d(?:[.,]\d)?)\s*[-\s]?\s*(?:year|yr)s?\b/i) ??
    text.match(/\bduration\s*[:\-]\s*(\d(?:[.,]\d)?)/i);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 && value <= 8 ? value : null;
}

export type DurationGuess = { years: number; source: "stated" | "text" | "qualification" };

/**
 * Resolve a duration for a staged course: use what is stored, else what the
 * document text states, else a typical duration for the qualification type.
 */
export function resolveDuration(s: StagedCourse): DurationGuess | null {
  if (s.duration_years != null) return { years: s.duration_years, source: "stated" };
  const fromText =
    durationFromText(s.description) ??
    durationFromText(s.requirements_text) ??
    durationFromText(s.qualification_name);
  if (fromText != null) return { years: fromText, source: "text" };
  const haystack = `${s.qualification_name ?? ""} ${s.name} ${s.code ?? ""}`.trim();
  for (const pattern of DURATION_PATTERNS) {
    if (pattern.test.test(haystack)) return { years: pattern.years, source: "qualification" };
  }
  return null;
}

/** Everything a reviewer still has to fill in before a record can go live. */
export function findMissingInformation(s: StagedCourse): MissingItem[] {
  const items: MissingItem[] = [];
  if (!s.name.trim()) items.push({ label: "Course name", blocking: true });
  if (!s.university_id) items.push({ label: "University link", blocking: true });
  if (!s.qualification_name) items.push({ label: "Qualification type", blocking: true });
  if (!s.faculty_name) items.push({ label: "Faculty", blocking: true });
  if (s.aps_requirement == null) items.push({ label: "APS requirement", blocking: false });
  if (resolveDuration(s) == null) items.push({ label: "Duration (years)", blocking: true });
  const hasSubjects = (s.extracted_payload?.subject_requirements?.length ?? 0) > 0;
  if (!hasSubjects && !s.requirements_text)
    items.push({ label: "Subject requirements", blocking: true });
  if (s.source_page == null) items.push({ label: "Source page in the PDF", blocking: false });
  return items;
}

export function hasBlockingGaps(s: StagedCourse): boolean {
  return findMissingInformation(s).some((i) => i.blocking);
}

export type ParsedMinimum =
  | { kind: "percentage"; value: number }
  | { kind: "level"; value: number }
  | { kind: "unknown" };

/** Turn free-text minimums such as "60%", "Level 5" or "5" into structured values. */
export function parseMinimum(raw: string | null): ParsedMinimum {
  if (!raw) return { kind: "unknown" };
  const text = raw.trim().toLowerCase();
  const pct = text.match(/(\d{1,3})\s*%/);
  if (pct?.[1]) {
    const value = Number(pct[1]);
    if (value >= 0 && value <= 100) return { kind: "percentage", value };
  }
  const level = text.match(/level\s*(\d)/) ?? text.match(/^(\d)\s*$/);
  if (level?.[1]) {
    const value = Number(level[1]);
    if (value >= 1 && value <= 7) return { kind: "level", value };
  }
  const bare = text.match(/^(\d{2,3})$/);
  if (bare?.[1]) {
    const value = Number(bare[1]);
    if (value >= 0 && value <= 100) return { kind: "percentage", value };
  }
  return { kind: "unknown" };
}

type SubjectRow = { id: string; name: string; code: string };

function normaliseName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchSubject(name: string, subjects: SubjectRow[]): SubjectRow | null {
  const target = normaliseName(name);
  if (!target) return null;
  return (
    subjects.find((s) => normaliseName(s.name) === target) ??
    subjects.find((s) => normaliseName(s.code) === target) ??
    subjects.find((s) => normaliseName(s.name).includes(target) || target.includes(normaliseName(s.name))) ??
    null
  );
}

export type PublishResult = { courseId: string; warnings: string[] };

export type BatchPublishOutcome = {
  published: number;
  skipped: { name: string; reason: string }[];
  failed: { name: string; reason: string }[];
  warnings: string[];
};

/**
 * Publish many approved staged courses in one pass. Records with blocking gaps
 * are skipped (never guessed at) and failures never stop the rest of the batch.
 */
export async function publishStagedCourses(
  rows: StagedCourse[],
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<BatchPublishOutcome> {
  const outcome: BatchPublishOutcome = { published: 0, skipped: [], failed: [], warnings: [] };
  const total = rows.length;
  let done = 0;
  for (const row of rows) {
    onProgress?.(done, total, row.name);
    if (row.status === "published") {
      done += 1;
      continue;
    }
    if (hasBlockingGaps(row)) {
      outcome.skipped.push({
        name: row.name,
        reason: findMissingInformation(row)
          .filter((m) => m.blocking)
          .map((m) => m.label)
          .join(", "),
      });
      done += 1;
      continue;
    }
    try {
      const result = await publishStagedCourse(row);
      outcome.published += 1;
      for (const warning of result.warnings) {
        if (!outcome.warnings.includes(warning)) outcome.warnings.push(warning);
      }
    } catch (err) {
      outcome.failed.push({
        name: row.name,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
    done += 1;
    onProgress?.(done, total, row.name);
  }
  return outcome;
}

async function resolveFaculty(universityId: string, name: string | null): Promise<string | null> {
  if (!name?.trim()) return null;
  const { data: existing } = await supabase
    .from("faculties")
    .select("id")
    .eq("university_id", universityId)
    .ilike("name", name.trim())
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("faculties")
    .insert({
      university_id: universityId,
      name: name.trim(),
      is_active: true,
      publication_status: "published",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function resolveQualificationType(name: string | null): Promise<string | null> {
  if (!name?.trim()) return null;
  const clean = name.trim();
  const { data: existing } = await supabase
    .from("qualification_types")
    .select("id")
    .ilike("name", clean)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const code = normaliseName(clean).replace(/\s+/g, "_").toUpperCase().slice(0, 40) || "QUALIFICATION";
  const { data, error } = await supabase
    .from("qualification_types")
    .insert({ code, name: clean })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Publish an approved staged course into the live catalogue, together with a
 * structured requirement set the eligibility engine can evaluate.
 */
export async function publishStagedCourse(s: StagedCourse): Promise<PublishResult> {
  if (!s.university_id) throw new Error("Link this record to a university before publishing.");
  const warnings: string[] = [];

  const { data: university } = await supabase
    .from("universities")
    .select("id, name, publication_status, is_active, aps_rule_id")
    .eq("id", s.university_id)
    .maybeSingle();
  if (!university) throw new Error("That university no longer exists.");
  if (university.publication_status !== "published" || !university.is_active)
    warnings.push(
      `${university.name} is not published yet, so students won't see this course until it is.`,
    );
  if (!university.aps_rule_id)
    warnings.push(
      `${university.name} has no confirmed APS calculation rule, so APS comparisons will be skipped for it.`,
    );

  const facultyId = await resolveFaculty(s.university_id, s.faculty_name);
  const qualificationTypeId = await resolveQualificationType(s.qualification_name);

  const duration = resolveDuration(s);
  if (duration && duration.source !== "stated")
    warnings.push(
      `${s.name}: no duration was stated, so a typical ${duration.years}-year duration was used for this qualification type.`,
    );

  const courseFields = {
    university_id: s.university_id,
    faculty_id: facultyId,
    qualification_type_id: qualificationTypeId,
    name: s.name,
    code: s.code,
    description: s.description,
    duration_years: duration?.years ?? null,
    aps_requirement: s.aps_requirement,
    application_url: s.application_url,
    is_active: true,
    is_demo: false,
    publication_status: "published",
    metadata: {
      source: "prospectus_review",
      prospectus_id: s.prospectus_id,
      staged_course_id: s.id,
      source_page: s.source_page,
      requirements_text: s.requirements_text,
      duration_source: duration?.source ?? null,
    },
  };

  // Publishing must be repeatable: a course with the same code (or, failing
  // that, the same name) at this university is updated instead of inserted,
  // otherwise a retry hits a duplicate-key conflict (409).
  let existingCourseId = s.published_course_id ?? null;
  if (!existingCourseId) {
    let lookup = supabase.from("courses").select("id").eq("university_id", s.university_id);
    lookup = s.code ? lookup.eq("code", s.code) : lookup.ilike("name", s.name);
    const { data: found } = await lookup.limit(1).maybeSingle();
    existingCourseId = found?.id ?? null;
  }

  let course: { id: string };
  if (existingCourseId) {
    const { data: updated, error: updateError } = await supabase
      .from("courses")
      .update(courseFields)
      .eq("id", existingCourseId)
      .select("id")
      .single();
    if (updateError) throw updateError;
    course = updated;
    warnings.push(`${s.name} already existed in the catalogue, so it was updated instead of added.`);
    // Remove the previous requirement sets so rules are not duplicated.
    await supabase.from("course_requirement_sets").delete().eq("course_id", course.id);
  } else {
    const { data: inserted, error: courseError } = await supabase
      .from("courses")
      .insert(courseFields)
      .select("id")
      .single();
    if (courseError) throw courseError;
    course = inserted;
  }

  const { data: set, error: setError } = await supabase
    .from("course_requirement_sets")
    .insert({
      course_id: course.id,
      name: "Admission requirements",
      description: s.requirements_text,
      min_aps: s.aps_requirement,
      is_active: true,
    })
    .select("id")
    .single();
  if (setError) throw setError;

  const { data: subjects } = await supabase.from("subjects").select("id, name, code");
  const subjectRows = (subjects ?? []) as SubjectRow[];

  const rules: Record<string, unknown>[] = [];
  if (s.aps_requirement != null) {
    rules.push({
      requirement_set_id: set.id,
      rule_type: "min_aps",
      min_aps: s.aps_requirement,
      is_required: true,
      description: `Minimum APS of ${s.aps_requirement}`,
      sort_order: 0,
    });
  }

  const extracted = s.extracted_payload?.subject_requirements ?? [];
  extracted.forEach((req, index) => {
    const subject = matchSubject(req.subject, subjectRows);
    if (!subject) {
      warnings.push(`"${req.subject}" doesn't match a known NSC subject and was not published as a rule.`);
      return;
    }
    const parsed = parseMinimum(req.minimum);
    if (parsed.kind === "unknown") {
      warnings.push(
        `No clear minimum for ${subject.name} ("${req.minimum ?? "none stated"}") — it was not published as a rule.`,
      );
      return;
    }
    rules.push({
      requirement_set_id: set.id,
      rule_type: parsed.kind === "percentage" ? "subject_min_percentage" : "subject_min_level",
      subject_id: subject.id,
      ...(parsed.kind === "percentage"
        ? { min_percentage: parsed.value }
        : { min_achievement_level: parsed.value }),
      is_required: true,
      description: req.note,
      sort_order: index + 1,
    });
  });

  if (rules.length > 0) {
    const { error: rulesError } = await supabase.from("course_requirement_rules").insert(rules as never);
    if (rulesError) throw rulesError;
  } else {
    warnings.push("No structured requirements could be published for this course.");
  }

  const { error: stagedError } = await supabase
    .from("staged_courses")
    .update({ status: "published", published_course_id: course.id })
    .eq("id", s.id);
  if (stagedError) throw stagedError;

  return { courseId: course.id, warnings };
}

/* ------------------------------------------------------------------ */
/* APS calculation rules proposed by AI                                */
/* ------------------------------------------------------------------ */

export type ApsRuleSummary = {
  id: string;
  code: string;
  name: string;
  version: string;
  status: "demo" | "unverified" | "verified";
  is_active: boolean;
  description: string | null;
  counting_subject_count: number | null;
};

export type RuleBandInput = { min: string; max: string; points: string; label: string };

export function bandsFromProposal(doc: ProspectusDocument): RuleBandInput[] {
  const bands = proposedAps(doc)?.bands ?? [];
  return bands.map((b) => ({
    min: String(b.min_percentage),
    max: String(b.max_percentage),
    points: String(b.points),
    label: b.label ?? "",
  }));
}

export async function fetchApsRuleSummary(ruleId: string): Promise<ApsRuleSummary | null> {
  const { data, error } = await supabase
    .from("aps_calculation_rules")
    .select("id, code, name, version, status, is_active, description, counting_subject_count")
    .eq("id", ruleId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ApsRuleSummary | null;
}

/**
 * Create the calculation rule a reviewer confirmed from the document. It is
 * always created UNVERIFIED and inactive — an administrator must explicitly
 * confirm it before the eligibility engine may use it.
 */
export async function createUnverifiedApsRule(input: {
  prospectusId: string;
  name: string;
  version: string;
  description: string | null;
  countingSubjectCount: number | null;
  bands: RuleBandInput[];
}): Promise<ApsRuleSummary> {
  const parsedBands = input.bands.map((b, index) => ({
    min_percentage: Number(b.min),
    max_percentage: Number(b.max),
    points: Number(b.points),
    label: b.label.trim() || null,
    sort_order: index,
  }));
  if (parsedBands.length === 0) throw new Error("Add at least one percentage band.");
  for (const band of parsedBands) {
    if (
      !Number.isFinite(band.min_percentage) ||
      !Number.isFinite(band.max_percentage) ||
      !Number.isFinite(band.points) ||
      band.min_percentage < 0 ||
      band.max_percentage > 100 ||
      band.min_percentage > band.max_percentage ||
      band.points < 0
    ) {
      throw new Error("Every band needs a valid 0–100 percentage range and a points value.");
    }
  }

  const code = `${normaliseName(input.name).replace(/\s+/g, "_").toUpperCase().slice(0, 30) || "RULE"}_${Date.now()
    .toString()
    .slice(-6)}`;

  const { data: rule, error } = await supabase
    .from("aps_calculation_rules")
    .insert({
      code,
      name: input.name.trim(),
      version: input.version.trim() || "v1",
      description: input.description,
      status: "unverified",
      is_active: false,
      counting_subject_count: input.countingSubjectCount,
    })
    .select("id, code, name, version, status, is_active, description, counting_subject_count")
    .single();
  if (error) throw error;

  const { error: bandError } = await supabase
    .from("aps_point_bands")
    .insert(parsedBands.map((b) => ({ ...b, rule_id: rule.id })));
  if (bandError) throw bandError;

  const { error: linkError } = await supabase
    .from("prospectus_documents")
    .update({ aps_rule_id: rule.id })
    .eq("id", input.prospectusId);
  if (linkError) throw linkError;

  return rule as ApsRuleSummary;
}

/** Explicit human confirmation: the rule becomes verified and usable live. */
export async function confirmApsRule(ruleId: string, universityId: string | null): Promise<void> {
  const { error } = await supabase
    .from("aps_calculation_rules")
    .update({ status: "verified", is_active: true })
    .eq("id", ruleId);
  if (error) throw error;
  if (universityId) {
    const { error: uniError } = await supabase
      .from("universities")
      .update({ aps_rule_id: ruleId })
      .eq("id", universityId);
    if (uniError) throw uniError;
  }
}

export async function unlinkApsRule(prospectusId: string, ruleId: string): Promise<void> {
  await supabase.from("prospectus_documents").update({ aps_rule_id: null }).eq("id", prospectusId);
  const { error } = await supabase.from("aps_calculation_rules").delete().eq("id", ruleId);
  if (error) throw error;
}

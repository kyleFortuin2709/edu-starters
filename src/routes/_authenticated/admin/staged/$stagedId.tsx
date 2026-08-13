import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  deleteStagedCourse,
  fetchStagedCourse,
  INGESTION_STATUSES,
  updateStagedCourse,
  type IngestionStatus,
  type StagedCourse,
} from "@/lib/prospectus";
import { IngestionStatusPill } from "@/components/IngestionStatusPill";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import {
  findMissingInformation,
  hasBlockingGaps,
  publishStagedCourse,
} from "@/lib/prospectus-publish";

export const Route = createFileRoute("/_authenticated/admin/staged/$stagedId")({
  head: () => ({
    meta: [
      { title: "Staged course — EduStarter admin" },
      { name: "description", content: "Edit staged course data before it is published live." },
      { property: "og:title", content: "Staged course — EduStarter admin" },
      { property: "og:description", content: "Edit staged course data safely." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StagedCoursePage,
});

type FormState = {
  name: string;
  code: string;
  faculty_name: string;
  qualification_name: string;
  description: string;
  duration_years: string;
  aps_requirement: string;
  application_url: string;
  requirements_text: string;
  source_page: string;
  review_notes: string;
  status: IngestionStatus;
};

function toForm(s: StagedCourse): FormState {
  return {
    name: s.name,
    code: s.code ?? "",
    faculty_name: s.faculty_name ?? "",
    qualification_name: s.qualification_name ?? "",
    description: s.description ?? "",
    duration_years: s.duration_years != null ? String(s.duration_years) : "",
    aps_requirement: s.aps_requirement != null ? String(s.aps_requirement) : "",
    application_url: s.application_url ?? "",
    requirements_text: s.requirements_text ?? "",
    source_page: s.source_page != null ? String(s.source_page) : "",
    review_notes: s.review_notes ?? "",
    status: s.status,
  };
}

function StagedCoursePage() {
  const { stagedId } = Route.useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState<StagedCourse | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let active = true;
    fetchStagedCourse(stagedId)
      .then((s) => {
        if (!active) return;
        setRecord(s);
        setForm(s ? toForm(s) : null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't load this staged course. Please refresh the page.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [stagedId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setMessage("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !record) return;
    setError("");
    setMessage("");

    if (!form.name.trim()) {
      setError("A staged course needs a name.");
      return;
    }
    const aps = form.aps_requirement.trim();
    if (aps && (!/^\d+$/.test(aps) || Number(aps) < 0 || Number(aps) > 60)) {
      setError("APS requirement must be a whole number between 0 and 60.");
      return;
    }
    const duration = form.duration_years.trim();
    if (duration && (Number.isNaN(Number(duration)) || Number(duration) <= 0)) {
      setError("Duration must be a number of years, for example 3 or 4.5.");
      return;
    }
    const page = form.source_page.trim();
    if (page && (!/^\d+$/.test(page) || Number(page) < 1)) {
      setError("Source page must be a whole page number.");
      return;
    }

    setSaving(true);
    try {
      const patch = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        faculty_name: form.faculty_name.trim() || null,
        qualification_name: form.qualification_name.trim() || null,
        description: form.description.trim() || null,
        duration_years: duration ? Number(duration) : null,
        aps_requirement: aps ? Number(aps) : null,
        application_url: form.application_url.trim() || null,
        requirements_text: form.requirements_text.trim() || null,
        source_page: page ? Number(page) : null,
        review_notes: form.review_notes.trim() || null,
        status: form.status,
      };
      await updateStagedCourse(record.id, patch);
      setRecord({ ...record, ...patch } as StagedCourse);
      setMessage("Staged changes saved. Nothing has been published to students.");
    } catch {
      setError("Those changes couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!record) return;
    setSaving(true);
    try {
      await deleteStagedCourse(record.id);
      navigate({
        to: "/admin/prospectuses/$prospectusId",
        params: { prospectusId: record.prospectus_id },
      });
    } catch {
      setError("That staged record couldn't be deleted. Please try again.");
      setSaving(false);
    }
  }

  async function setReviewStatus(status: IngestionStatus, note: string) {
    if (!record) return;
    setSaving(true);
    setError("");
    try {
      await updateStagedCourse(record.id, { status });
      setRecord({ ...record, status });
      setForm((prev) => (prev ? { ...prev, status } : prev));
      setMessage(note);
    } catch {
      setError("That review decision couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!record) return;
    setPublishing(true);
    setError("");
    setMessage("");
    setWarnings([]);
    try {
      const result = await publishStagedCourse(record);
      setRecord({ ...record, status: "published", published_course_id: result.courseId });
      setForm((prev) => (prev ? { ...prev, status: "published" } : prev));
      setWarnings(result.warnings);
      setMessage("Published to the live course database. The staged record is kept as the source.");
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "This record couldn't be published. Please try again.",
      );
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <p className="mt-10 text-sm text-muted-foreground">Loading staged course…</p>;
  if (!record || !form)
    return (
      <p className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        We couldn't find that staged course.{" "}
        <Link to="/admin/prospectuses" className="font-semibold underline">
          Back to prospectuses
        </Link>
      </p>
    );

  return (
    <section className="pb-16">
      <Link
        to="/admin/prospectuses/$prospectusId"
        params={{ prospectusId: record.prospectus_id }}
        className="mt-8 inline-block font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← Back to prospectus
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Staged course</h1>
        <IngestionStatusPill status={record.status} />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        This record is staging data only. Saving keeps it in review — it never changes the live
        course catalogue or what students see.
      </p>

      {error && (
        <p className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {message && !error && (
        <p className="mt-6 rounded-2xl border border-success/30 bg-success/5 p-4 text-sm text-success">
          {message}
        </p>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm">
          <h2 className="font-semibold">Published with notes</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-[2rem] border border-border bg-card p-6 md:p-8">
        <h2 className="font-display text-2xl font-semibold">Completeness check</h2>
        {!record.university_id && (
          <p className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            This document has no institution yet. Fix it once for every course by registering or
            linking the institution on the{" "}
            <Link
              to="/admin/prospectuses/$prospectusId"
              params={{ prospectusId: record.prospectus_id }}
              className="font-semibold underline"
            >
              prospectus page
            </Link>
            .
          </p>
        )}
        {findMissingInformation(record).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Every field we check for is filled in. Confirm the detail against the PDF before
            approving.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Missing information found in this extracted course:
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {findMissingInformation(record).map((item) => (
                <li
                  key={item.label}
                  className={
                    item.blocking
                      ? "rounded-full border border-destructive/40 bg-destructive/5 px-3 py-1 text-xs font-semibold text-destructive"
                      : "rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground"
                  }
                >
                  {item.label}
                  {item.blocking ? " — required" : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {record.extracted_payload?.source === "ai_extraction" && (
        <div className="mt-6 rounded-[2rem] border border-border bg-card p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">AI extraction</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Captured from the prospectus by {record.extracted_payload.model ?? "AI"}
            {record.extracted_payload.confidence
              ? ` · confidence: ${record.extracted_payload.confidence}`
              : ""}
            . Every field below stays editable and must be checked before publishing.
          </p>
          {record.extracted_payload.review_flags?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">Flagged for human review</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {record.extracted_payload.review_flags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {record.extracted_payload.subject_requirements?.length ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Subject requirements found</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {record.extracted_payload.subject_requirements.map((s) => (
                  <li key={`${s.subject}-${s.minimum ?? ""}`}>
                    <span className="font-medium text-foreground">{s.subject}</span>
                    {s.minimum ? ` — ${s.minimum}` : " — no minimum stated"}
                    {s.note ? ` (${s.note})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <form onSubmit={save} className="mt-8 space-y-6">
        <div className="rounded-[2rem] border border-border bg-card p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">Course information</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <TextField
              id="staged-name"
              label="Course name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <TextField
              id="staged-code"
              label="Course code"
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
            />
            <TextField
              id="staged-faculty"
              label="Faculty (as printed)"
              value={form.faculty_name}
              onChange={(e) => set("faculty_name", e.target.value)}
            />
            <TextField
              id="staged-qualification"
              label="Qualification (as printed)"
              value={form.qualification_name}
              onChange={(e) => set("qualification_name", e.target.value)}
            />
            <TextField
              id="staged-duration"
              label="Duration (years)"
              inputMode="decimal"
              value={form.duration_years}
              onChange={(e) => set("duration_years", e.target.value)}
            />
            <TextField
              id="staged-aps"
              label="APS requirement"
              inputMode="numeric"
              value={form.aps_requirement}
              onChange={(e) => set("aps_requirement", e.target.value)}
            />
            <TextField
              id="staged-url"
              label="Application link"
              value={form.application_url}
              onChange={(e) => set("application_url", e.target.value)}
            />
            <TextField
              id="staged-page"
              label="Source page in PDF"
              inputMode="numeric"
              value={form.source_page}
              onChange={(e) => set("source_page", e.target.value)}
            />
          </div>

          <label htmlFor="staged-description" className="mt-6 block text-sm font-semibold">
            Description
          </label>
          <textarea
            id="staged-description"
            rows={4}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">Requirements (as captured)</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Capture the wording from the prospectus here. Structured requirement rules are created
            later, when the record is moved into the live catalogue.
          </p>
          <textarea
            id="staged-requirements"
            rows={6}
            value={form.requirements_text}
            onChange={(e) => set("requirements_text", e.target.value)}
            className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">Review</h2>
          <div className="mt-6 grid gap-4 md:max-w-sm">
            <SelectField
              id="staged-status"
              label="Status"
              value={form.status}
              onChange={(e) => set("status", e.target.value as IngestionStatus)}
              options={INGESTION_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>
          <label htmlFor="staged-notes" className="mt-6 block text-sm font-semibold">
            Reviewer notes
          </label>
          <textarea
            id="staged-notes"
            rows={3}
            value={form.review_notes}
            onChange={(e) => set("review_notes", e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save staged changes"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={remove}
            className="rounded-full border border-destructive/40 px-6 py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60"
          >
            Delete staged record
          </button>
        </div>
      </form>

      <div className="mt-8 rounded-[2rem] border border-border bg-card p-6 md:p-8">
        <h2 className="font-display text-2xl font-semibold">Review decision</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Approve a record once every field has been checked against the PDF. Rejecting sends it
          back for more work. Publishing copies it into the live course database, where the
          eligibility engine can use it — the staged record stays as the source of truth.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving || publishing || hasBlockingGaps(record) || record.status === "published"}
            onClick={() =>
              setReviewStatus("approved", "Approved. It can now be published to the live database.")
            }
            className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
          >
            Approve record
          </button>
          <button
            type="button"
            disabled={saving || publishing || record.status === "published"}
            onClick={() =>
              setReviewStatus("review_required", "Rejected. This record needs more work.")
            }
            className="rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
          >
            Reject — needs more work
          </button>
          <button
            type="button"
            disabled={saving || publishing || record.status !== "approved"}
            onClick={publish}
            className="rounded-full border border-success/50 bg-success/10 px-6 py-3 text-sm font-semibold text-foreground hover:bg-success/20 disabled:opacity-60"
          >
            {publishing ? "Publishing…" : "Publish to live database"}
          </button>
        </div>
        {hasBlockingGaps(record) && (
          <p className="mt-3 text-xs text-destructive">
            Fill in the required fields above before this record can be approved.
          </p>
        )}
        {record.status !== "approved" && record.status !== "published" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Only approved records can be published.
          </p>
        )}
        {record.published_course_id && (
          <p className="mt-4 text-sm">
            <Link
              to="/admin/courses/$courseId"
              params={{ courseId: record.published_course_id }}
              className="font-semibold underline"
            >
              View the live course this record created
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

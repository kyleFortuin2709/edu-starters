import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  createProspectusFileUrl,
  createStagedCourse,
  deleteProspectus,
  fetchProspectus,
  fetchStagedCourses,
  formatFileSize,
  INGESTION_STATUSES,
  updateProspectus,
  type IngestionStatus,
  type ProspectusDocument,
  type StagedCourse,
} from "@/lib/prospectus";
import { IngestionStatusPill } from "@/components/IngestionStatusPill";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { extractProspectus } from "@/lib/prospectus-extract.functions";
import { ApsRuleReviewCard } from "@/components/ApsRuleReviewCard";
import { InstitutionReviewCard } from "@/components/InstitutionReviewCard";
import { FacultyReviewCard } from "@/components/FacultyReviewCard";
import { ApsCalculatorAiReviewCard } from "@/components/ApsCalculatorAiReviewCard";
import { ApsCalculatorManager } from "@/components/ApsCalculatorManager";
import {
  findMissingInformation,
  hasBlockingGaps,
  publishStagedCourses,
  type BatchPublishOutcome,
  resolveDuration,
} from "@/lib/prospectus-publish";
import { ExtractionProgress } from "@/components/ExtractionProgress";

export const Route = createFileRoute("/_authenticated/admin/prospectuses/$prospectusId")({
  head: () => ({
    meta: [
      { title: "Prospectus review — EduStarter admin" },
      { name: "description", content: "Review a prospectus and its staged course records." },
      { property: "og:title", content: "Prospectus review — EduStarter admin" },
      { property: "og:description", content: "Review staged course data before publishing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProspectusDetailPage,
});

function ProspectusDetailPage() {
  const { prospectusId } = Route.useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<ProspectusDocument | null>(null);
  const [staged, setStaged] = useState<StagedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [stagedCollapsed, setStagedCollapsed] = useState(true);
  const [openFaculties, setOpenFaculties] = useState<Record<string, boolean>>({});
  const unpublishedCount = staged.filter((s) => s.status !== "published").length;
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; name: string } | null>(
    null,
  );
  const [bulkReport, setBulkReport] = useState<BatchPublishOutcome | null>(null);

  const readyCourses = staged.filter((s) => s.status !== "published" && !hasBlockingGaps(s));

  async function publishBatch(rows: StagedCourse[]) {
    if (rows.length === 0) return;
    setBulkBusy(true);
    setBulkReport(null);
    setError("");
    setMessage("");
    setBulkProgress({ done: 0, total: rows.length, name: rows[0]?.name ?? "" });
    try {
      const outcome = await publishStagedCourses(rows, (done, total, name) =>
        setBulkProgress({ done, total, name }),
      );
      const refreshed = await fetchStagedCourses(prospectusId);
      setStaged(refreshed);
      setBulkReport(outcome);
      setMessage(
        `${outcome.published} course${outcome.published === 1 ? "" : "s"} published to the live catalogue.`,
      );
    } catch {
      setError("That bulk publish couldn't be completed. Please try again.");
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  }

  async function runExtraction() {
    if (!doc) return;
    setExtracting(true);
    setError("");
    setMessage("");
    setDoc({ ...doc, status: "processing" });
    try {
      const result = await extractProspectus({ data: { prospectusId: doc.id } });
      const [refreshed, stagedRows] = await Promise.all([
        fetchProspectus(doc.id),
        fetchStagedCourses(doc.id),
      ]);
      setDoc(refreshed);
      setStaged(stagedRows);
      setMessage(
        `${result.stagedCount} course${result.stagedCount === 1 ? "" : "s"} staged for review.` +
          (result.apsMethodologyFound ? " APS methodology text was captured." : "") +
          " Nothing was written to the live catalogue.",
      );
    } catch (err) {
      const refreshed = await fetchProspectus(doc.id).catch(() => null);
      if (refreshed) setDoc(refreshed);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "We couldn't analyse that document. Please try again.",
      );
    } finally {
      setExtracting(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchProspectus(prospectusId), fetchStagedCourses(prospectusId)])
      .then(([d, s]) => {
        if (!active) return;
        setDoc(d);
        setStaged(s);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't load this prospectus. Please refresh the page.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [prospectusId]);

  async function changeStatus(status: IngestionStatus) {
    if (!doc) return;
    setBusy(true);
    setError("");
    try {
      await updateProspectus(doc.id, { status });
      setDoc({ ...doc, status });
      setMessage("Status updated.");
    } catch {
      setError("That status change couldn't be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes(notes: string) {
    if (!doc) return;
    setBusy(true);
    try {
      await updateProspectus(doc.id, { notes });
      setDoc({ ...doc, notes });
      setMessage("Notes saved.");
    } catch {
      setError("Your notes couldn't be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addStaged(event: React.FormEvent) {
    event.preventDefault();
    if (!doc || !newName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await createStagedCourse(doc.id, {
        name: newName.trim(),
        university_id: doc.university_id,
      });
      setStaged((prev) => [...prev, created]);
      setNewName("");
      setMessage("Staging record created. It stays separate from the live catalogue.");
    } catch {
      setError("That staging record couldn't be created. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openFile() {
    if (!doc) return;
    const url = await createProspectusFileUrl(doc.storage_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setError("We couldn't open that file right now.");
  }

  async function removeProspectus() {
    if (!doc) return;
    setBusy(true);
    try {
      await deleteProspectus(doc);
      navigate({ to: "/admin/prospectuses" });
    } catch {
      setError("That prospectus couldn't be deleted. Please try again.");
      setBusy(false);
    }
  }

  if (loading) return <p className="mt-10 text-sm text-muted-foreground">Loading prospectus…</p>;
  if (!doc)
    return (
      <p className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        We couldn't find that prospectus.{" "}
        <Link to="/admin/prospectuses" className="font-semibold underline">
          Back to prospectuses
        </Link>
      </p>
    );

  return (
    <section className="pb-16">
      <Link
        to="/admin/prospectuses"
        className="mt-8 inline-block font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← All prospectuses
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{doc.title}</h1>
        <IngestionStatusPill status={doc.status} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {[
          doc.universities?.name ?? "No university linked",
          doc.academic_year,
          doc.file_name,
          formatFileSize(doc.file_size),
        ]
          .filter(Boolean)
          .join(" · ")}
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-[2rem] border border-border bg-card p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">Processing status</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Move the document through the review workflow by hand. Automated extraction will set
            these statuses later.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {INGESTION_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                disabled={busy || doc.status === s.value}
                onClick={() => changeStatus(s.value)}
                className={
                  doc.status === s.value
                    ? "rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
                    : "rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
                }
              >
                {s.label}
              </button>
            ))}
          </div>

          <label
            htmlFor="prospectus-notes"
            className="mt-8 block text-sm font-semibold text-foreground"
          >
            Review notes
          </label>
          <textarea
            id="prospectus-notes"
            defaultValue={doc.notes ?? ""}
            rows={4}
            onBlur={(e) => saveNotes(e.target.value)}
            placeholder="What still needs checking in this document?"
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Notes save when you click away.</p>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">Document</h2>
          <button
            type="button"
            onClick={runExtraction}
            disabled={extracting || busy}
            className="mt-4 w-full rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
          >
            {extracting ? "Reading document…" : "Extract with AI"}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Extraction only creates staged records for review. Missing or unclear details are
            flagged instead of guessed, and nothing reaches the live catalogue.
          </p>
          {extracting && <ExtractionProgress fileName={doc.file_name} />}
          <button
            type="button"
            onClick={openFile}
            className="mt-3 w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Open PDF
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={removeProspectus}
            className="mt-3 w-full rounded-full border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60"
          >
            Delete prospectus
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            Deleting removes the file and every staged record created from it. Live courses are
            never affected.
          </p>
        </div>
      </div>

      {(doc.extracted_at || doc.error_message) && (
        <div className="mt-6 rounded-[2rem] border border-border bg-card p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">AI extraction</h2>
          {doc.error_message && (
            <p className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Last run reported: {doc.error_message}
            </p>
          )}
          {doc.extracted_at && (
            <p className="mt-3 text-sm text-muted-foreground">
              Last run {new Date(doc.extracted_at).toLocaleString()}
              {doc.extraction_model ? ` · ${doc.extraction_model}` : ""}
              {doc.extraction_payload?.university_name
                ? ` · University detected: ${doc.extraction_payload.university_name}`
                : ""}
            </p>
          )}
          {doc.extraction_payload?.document_flags?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">Needs human review</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {doc.extraction_payload.document_flags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <ApsRuleReviewCard doc={doc}>
        {doc.university_id ? (
          <ApsCalculatorManager
            universityId={doc.university_id}
            variant="registration"
            title="APS calculators for this institution"
          />
        ) : null}
      </ApsRuleReviewCard>

      <InstitutionReviewCard
        doc={doc}
        onInstitutionLinked={(institution) => {
          setDoc((prev) =>
            prev
              ? {
                  ...prev,
                  university_id: institution.id,
                  universities: { id: institution.id, name: institution.name },
                }
              : prev,
          );
          setStaged((prev) =>
            prev.map((s) =>
              s.status === "published" ? s : { ...s, university_id: institution.id },
            ),
          );
        }}
      />

      <FacultyReviewCard
        prospectusId={doc.id}
        universityId={doc.university_id}
        staged={staged}
        onStagedUpdated={(ids, facultyName) =>
          setStaged((prev) =>
            prev.map((s) => (ids.includes(s.id) ? { ...s, faculty_name: facultyName } : s)),
          )
        }
      />

      <ApsCalculatorAiReviewCard prospectusId={doc.id} universityId={doc.university_id} />

      <div
        className={`mt-10 rounded-[2rem] border bg-card p-6 md:p-8 ${
          stagedCollapsed && unpublishedCount > 0 ? "border-warning/50 bg-warning/5" : "border-border"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Step 3 · Staged courses</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {unpublishedCount > 0 ? (
                <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning-foreground">
                  {unpublishedCount} course{unpublishedCount === 1 ? "" : "s"} not published
                </span>
              ) : (
                staged.length > 0 && (
                  <span className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                    All courses published
                  </span>
                )
              )}
              <span className="text-xs text-muted-foreground">{staged.length} staged</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStagedCollapsed((v) => !v)}
            aria-expanded={!stagedCollapsed}
            aria-label={stagedCollapsed ? "Expand staged courses" : "Collapse staged courses"}
            className="rounded-full border border-border p-2 hover:bg-secondary"
          >
            {stagedCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>

        {!stagedCollapsed && (
          <>
        <p className="mt-4 text-sm text-muted-foreground">
          Staged records are a safe scratch space. They are never shown to students and are not part
          of the live course database.
        </p>

        <div className="mt-5 rounded-2xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkBusy || readyCourses.length === 0}
              onClick={() => publishBatch(readyCourses)}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
            >
              {bulkBusy
                ? "Publishing…"
                : `Publish all ready courses (${readyCourses.length})`}
            </button>
            <span className="text-xs text-muted-foreground">
              {unpublishedCount - readyCourses.length} course
              {unpublishedCount - readyCourses.length === 1 ? "" : "s"} still need a fix before they
              can go live.
            </span>
          </div>
          {bulkProgress && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.round((bulkProgress.done / Math.max(bulkProgress.total, 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {bulkProgress.done} of {bulkProgress.total} · {bulkProgress.name}
              </p>
            </div>
          )}
          {bulkReport && (
            <div className="mt-3 space-y-2 text-xs">
              {bulkReport.skipped.length > 0 && (
                <details className="rounded-xl border border-warning/40 bg-warning/5 p-3">
                  <summary className="cursor-pointer font-semibold text-warning-foreground">
                    {bulkReport.skipped.length} skipped — missing required details
                  </summary>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {bulkReport.skipped.map((s) => (
                      <li key={s.name}>
                        {s.name} — {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {bulkReport.failed.length > 0 && (
                <details className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <summary className="cursor-pointer font-semibold text-destructive">
                    {bulkReport.failed.length} failed
                  </summary>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {bulkReport.failed.map((f) => (
                      <li key={f.name}>
                        {f.name} — {f.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {bulkReport.warnings.length > 0 && (
                <details className="rounded-xl border border-border p-3">
                  <summary className="cursor-pointer font-semibold">
                    {bulkReport.warnings.length} warning
                    {bulkReport.warnings.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {bulkReport.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
        {!doc.university_id && (
          <p className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
            Register or link the institution above first. Course review stays open, but no course
            can be published until this document belongs to an institution.
          </p>
        )}

        <form onSubmit={addStaged} className="mt-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <TextField
              id="staged-name"
              label="New staged course name"
              placeholder="e.g. Bachelor of Science"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
          >
            Create staging record
          </button>
        </form>

        {staged.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground">
            No staged courses yet. Create one above to start capturing course information for
            review.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {groupStagedByFaculty(staged).map(({ faculty, courses }) => {
              const key = faculty ?? "__none__";
              const pending = courses.filter((c) => c.status !== "published").length;
              const open = openFaculties[key] ?? false;
              return (
              <div
                key={key}
                className={`space-y-3 rounded-2xl border p-4 ${
                  pending > 0 ? "border-warning/40" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaculties((prev) => ({ ...prev, [key]: !open }))}
                  aria-expanded={open}
                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                >
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {faculty ?? "No faculty captured"} ({courses.length})
                  </span>
                  <span className="flex items-center gap-2">
                    {pending > 0 ? (
                      <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning-foreground">
                        {pending} not published
                      </span>
                    ) : (
                      <span className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                        Published
                      </span>
                    )}
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>
                {pending > 0 && (
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() =>
                      publishBatch(courses.filter((c) => c.status !== "published" && !hasBlockingGaps(c)))
                    }
                    className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                  >
                    Publish this faculty's ready courses (
                    {courses.filter((c) => c.status !== "published" && !hasBlockingGaps(c)).length})
                  </button>
                )}
                {open && courses.map((s) => (
              <article
                key={s.id}
                className="rounded-2xl border border-border bg-background p-5 md:flex md:items-center md:justify-between md:gap-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{s.name}</h3>
                    <IngestionStatusPill status={s.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      s.faculty_name,
                      s.qualification_name,
                      s.aps_requirement != null ? `APS ${s.aps_requirement}` : null,
                      (() => {
                        const d = resolveDuration(s);
                        return d
                          ? `${d.years} ${d.years === 1 ? "year" : "years"}${d.source === "stated" ? "" : " (est.)"}`
                          : null;
                      })(),
                      s.source_page != null ? `Page ${s.source_page}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No details captured yet"}
                  </p>
                  {findMissingInformation(s).length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Missing: {findMissingInformation(s).map((m) => m.label).join(", ")}
                    </p>
                  )}
                </div>
                <Link
                  to="/admin/staged/$stagedId"
                  params={{ stagedId: s.id }}
                  className="mt-3 inline-block rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary md:mt-0 md:shrink-0"
                >
                  View & edit
                </Link>
              </article>
                ))}
              </div>
              );
            })}
          </div>
        )}
          </>
        )}
      </div>
    </section>
  );
}

function groupStagedByFaculty(staged: StagedCourse[]) {
  const groups: { faculty: string | null; courses: StagedCourse[] }[] = [];
  for (const course of staged) {
    const faculty = course.faculty_name?.trim() || null;
    const existing = groups.find((g) => (g.faculty ?? "") === (faculty ?? ""));
    if (existing) existing.courses.push(course);
    else groups.push({ faculty, courses: [course] });
  }
  return groups.sort((a, b) => (a.faculty ?? "zzz").localeCompare(b.faculty ?? "zzz"));
}

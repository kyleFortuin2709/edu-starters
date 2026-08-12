import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchAdminUniversities, type AdminUniversity } from "@/lib/admin";
import {
  fetchProspectuses,
  formatFileSize,
  uploadProspectus,
  INGESTION_STATUSES,
  type ProspectusDocument,
} from "@/lib/prospectus";
import { IngestionStatusPill } from "@/components/IngestionStatusPill";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";

export const Route = createFileRoute("/_authenticated/admin/prospectuses/")({
  head: () => ({
    meta: [
      { title: "Prospectuses — EduStarter admin" },
      {
        name: "description",
        content: "Upload university prospectus PDFs and track their review status.",
      },
      { property: "og:title", content: "Prospectuses — EduStarter admin" },
      { property: "og:description", content: "Upload and track EduStarter prospectus documents." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProspectusListPage,
});

function ProspectusListPage() {
  const [docs, setDocs] = useState<ProspectusDocument[]>([]);
  const [universities, setUniversities] = useState<AdminUniversity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadDone, setUploadDone] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchProspectuses(), fetchAdminUniversities()])
      .then(([d, u]) => {
        if (!active) return;
        setDocs(d);
        setUniversities(u);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't load the prospectuses. Please refresh the page.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () => docs.filter((d) => (statusFilter ? d.status === statusFilter : true)),
    [docs, statusFilter],
  );

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    setUploadError("");
    setUploadDone("");

    if (!file) {
      setUploadError("Please choose a PDF prospectus to upload.");
      return;
    }
    if (file.type && file.type !== "application/pdf") {
      setUploadError("Only PDF files can be uploaded.");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setUploadError("That file is larger than 40 MB. Please upload a smaller PDF.");
      return;
    }

    setUploading(true);
    try {
      const created = await uploadProspectus({
        file,
        title: title.trim() || file.name.replace(/\.pdf$/i, ""),
        universityId: universityId || null,
        academicYear: academicYear.trim() || null,
        notes: null,
      });
      setDocs((prev) => [created, ...prev]);
      setFile(null);
      setTitle("");
      setAcademicYear("");
      setUploadDone("Prospectus uploaded. It's ready for staging and review.");
      (document.getElementById("prospectus-file") as HTMLInputElement | null)?.value &&
        ((document.getElementById("prospectus-file") as HTMLInputElement).value = "");
    } catch {
      setUploadError("That upload didn't go through. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section>
      <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">Prospectuses</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Upload prospectus PDFs and capture course information into a staging area. Nothing here
        reaches students until you move it into the live catalogue yourself — automated extraction
        is not connected yet.
      </p>

      <form
        onSubmit={handleUpload}
        className="mt-8 rounded-[2rem] border border-border bg-card p-6 md:p-8"
      >
        <h2 className="font-display text-2xl font-semibold">Upload a prospectus</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="prospectus-file" className="text-sm font-semibold text-foreground">
              PDF file
            </label>
            <input
              id="prospectus-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-semibold"
            />
          </div>
          <TextField
            id="prospectus-title"
            label="Title"
            placeholder="e.g. Undergraduate prospectus"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <SelectField
            id="prospectus-university"
            label="University (optional)"
            placeholder="Not linked yet"
            value={universityId}
            onChange={(e) => setUniversityId(e.target.value)}
            options={universities.map((u) => ({ value: u.id, label: u.name }))}
          />
          <TextField
            id="prospectus-year"
            label="Academic year (optional)"
            placeholder="e.g. 2027"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          />
        </div>

        {uploadError && (
          <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {uploadError}
          </p>
        )}
        {uploadDone && (
          <p className="mt-4 rounded-2xl border border-success/30 bg-success/5 p-4 text-sm text-success">
            {uploadDone}
          </p>
        )}

        <button
          type="submit"
          disabled={uploading}
          className="mt-6 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload prospectus"}
        </button>
      </form>

      <div className="mt-10 sm:max-w-xs">
        <SelectField
          id="prospectus-status-filter"
          label="Status"
          placeholder="All statuses"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={INGESTION_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>

      {error && (
        <p className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading prospectuses…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No prospectuses yet. Upload a PDF above to start a review workflow.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {filtered.map((doc) => (
            <article
              key={doc.id}
              className="rounded-[1.75rem] border border-border bg-card p-6 md:flex md:items-center md:justify-between md:gap-6"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl font-semibold">{doc.title}</h3>
                  <IngestionStatusPill status={doc.status} />
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {[
                    doc.universities?.name ?? "No university linked",
                    doc.academic_year,
                    doc.file_name,
                    formatFileSize(doc.file_size),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Link
                to="/admin/prospectuses/$prospectusId"
                params={{ prospectusId: doc.id }}
                className="mt-4 inline-block rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-primary md:mt-0 md:shrink-0"
              >
                Open
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

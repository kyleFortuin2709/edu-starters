import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Loader2, Upload, X } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import {
  fetchDocumentState,
  fetchExtractedSubjects,
  startExtraction,
  uploadResultsDocument,
  validateFile,
  type ExtractedSubject,
} from "@/lib/matric-extract";

const POLL_MS = 2500;
const POLL_TIMEOUT_MS = 180_000;

type Phase = "idle" | "uploading" | "starting" | "processing" | "done" | "error";

const PHASE_LABEL: Record<string, string> = {
  uploading: "Uploading your document…",
  starting: "Reading your results…",
  processing: "Extracting your subjects and marks…",
};

export function ResultsDocumentUpload({ userId }: { userId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<ExtractedSubject[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const busy = phase === "uploading" || phase === "starting" || phase === "processing";

  function choose(next: File | null) {
    if (busy || !next) return;
    const problem = validateFile(next);
    if (problem) {
      setError(problem);
      setFile(null);
      return;
    }
    setError("");
    setSubjects(null);
    setPhase("idle");
    setFile(next);
  }

  function clearFile() {
    if (busy) return;
    setFile(null);
    setError("");
    setSubjects(null);
    setPhase("idle");
    if (fileInput.current) fileInput.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  }

  async function handleSubmit() {
    if (!file || busy) return;
    setError("");
    setSubjects(null);
    try {
      setPhase("uploading");
      const path = await uploadResultsDocument(userId, file);
      setPhase("starting");
      const documentId = await startExtraction(userId, path);
      setPhase("processing");

      const startedAt = Date.now();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        if (cancelled.current) return;
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          throw new Error("Reading your document is taking longer than expected. Please try again.");
        }
        const state = await fetchDocumentState(documentId);
        if (state.status === "failed") {
          throw new Error("We couldn't read your results from that document. Please try a clearer photo or PDF.");
        }
        if (state.status === "review_required") break;
      }

      const rows = await fetchExtractedSubjects(documentId);
      if (cancelled.current) return;
      setSubjects(rows);
      setPhase("done");
    } catch (caught) {
      if (cancelled.current) return;
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
      setPhase("error");
    }
  }

  return (
    <div className="rounded-[2rem] border border-border bg-card p-6 md:p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Faster option</p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
        Upload your results document
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Matric certificate, statement of results or a school report — take a photo or upload a JPG, PNG
        or PDF (max 20 MB). We'll read the subjects and marks for you to review.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => choose(e.target.files?.[0] ?? null)}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => choose(e.target.files?.[0] ?? null)}
      />

      <div className="mt-5 flex flex-wrap gap-3">
        <ActionButton
          variant="outline"
          onClick={() => cameraInput.current?.click()}
          disabled={busy}
          type="button"
        >
          <Camera className="mr-2 size-4" aria-hidden="true" />
          Take a photo
        </ActionButton>
        <ActionButton
          variant="outline"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          type="button"
        >
          <Upload className="mr-2 size-4" aria-hidden="true" />
          Choose a file
        </ActionButton>
      </div>

      {file ? (
        <div className="mt-5 rounded-2xl border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={clearFile}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
            >
              <X className="size-3.5" aria-hidden="true" />
              Remove
            </button>
          </div>

          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview of the results document you selected"
              className="mt-3 max-h-72 w-full rounded-xl border border-border object-contain"
            />
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              <FileText className="size-4" aria-hidden="true" />
              PDF selected — no preview available.
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5">
          <FormMessage>{error}</FormMessage>
        </div>
      ) : null}

      {busy ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          {PHASE_LABEL[phase] ?? "Working…"}
        </div>
      ) : null}

      {file ? (
        <ActionButton size="block" className="mt-5" onClick={handleSubmit} disabled={busy} type="button">
          {busy ? "Reading your document…" : phase === "error" ? "Try again" : "Extract my results"}
        </ActionButton>
      ) : null}

      {subjects ? (
        subjects.length === 0 ? (
          <div className="mt-6">
            <FormMessage>
              We couldn't find any subjects in that document. Please try a clearer photo, or add your
              subjects manually below.
            </FormMessage>
          </div>
        ) : (
          <div className="mt-6">
            <h3 className="font-display text-xl font-semibold">Extracted results</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              These were read from your document and are <strong>not verified</strong>. Please check every
              subject and mark against your certificate, then capture them below.
            </p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/60">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Subject</th>
                    <th className="px-4 py-2.5 font-semibold">Mark</th>
                    <th className="px-4 py-2.5 font-semibold">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        {row.subject_name_raw ?? "Unnamed subject"}
                        {row.is_life_orientation ? (
                          <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            Life Orientation
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.percentage != null ? `${row.percentage}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5">{row.achievement_level ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
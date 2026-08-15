import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import { ResultsDocumentUpload } from "@/components/ResultsDocumentUpload";
import { useAuth } from "@/lib/auth";
import { type ExtractedSubject } from "@/lib/matric-extract";
import {
  achievementLevelForMark,
  fetchMyResults,
  fetchSubjects,
  saveMyResults,
  type Subject,
} from "@/lib/results";

export const Route = createFileRoute("/_authenticated/results")({
  head: () => ({
    meta: [
      { title: "Your NSC results — EduStarter" },
      {
        name: "description",
        content:
          "Add and edit your NSC subjects and marks so EduStarter can work with your results.",
      },
      { property: "og:title", content: "Your NSC results — EduStarter" },
      {
        property: "og:description",
        content: "Add and edit your NSC subjects and marks in EduStarter.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResultsPage,
});

type Row = { key: string; subjectId: string; mark: string };

let rowSeq = 0;
const newRow = (subjectId = "", mark = ""): Row => ({ key: `r${rowSeq++}`, subjectId, mark });

const DRAFT_KEY = (userId: string) => `edustarter.results.draft.${userId}`;

function readDraft(userId: string): Row[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const rows = parsed.flatMap((item): Row[] => {
      if (!item || typeof item !== "object") return [];
      const row = item as { subjectId?: unknown; mark?: unknown };
      return [
        newRow(
          typeof row.subjectId === "string" ? row.subjectId : "",
          typeof row.mark === "string" ? row.mark : "",
        ),
      ];
    });
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

function writeDraft(userId: string, rows: Row[] | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!rows) window.localStorage.removeItem(DRAFT_KEY(userId));
    else
      window.localStorage.setItem(
        DRAFT_KEY(userId),
        JSON.stringify(rows.map((r) => ({ subjectId: r.subjectId, mark: r.mark }))),
      );
  } catch {
    /* ignore storage failures */
  }
}

function ResultsPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extractionNotice, setExtractionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const [subjectList, results] = await Promise.all([
          fetchSubjects(),
          fetchMyResults(user.id),
        ]);
        if (!active) return;
        setSubjects(subjectList);
        const draft = readDraft(user.id);
        const initialRows =
          results.length
            ? results.map((r) => newRow(r.subject_id ?? "", r.mark != null ? String(r.mark) : ""))
            : [newRow(), newRow(), newRow()];
        if (draft) {
          // Unsaved edits (including marks read from an uploaded document) win
          // so nothing is lost when the student navigates away before saving.
          setRows(draft);
          setSaved(false);
          setExtractionNotice(
            "We kept the marks you hadn't saved yet. Check them and press Save my results.",
          );
        } else {
          setRows(initialRows);
          setSaved(results.length > 0);
        }
      } catch {
        if (active)
          setFormError("We couldn't load your results right now. Please refresh the page.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const grouped = useMemo(() => {
    return groupSubjects(subjects);
  }, [subjects]);

  // Keep unsaved edits in the browser so switching tabs or pages never loses them.
  useEffect(() => {
    if (!user || loading) return;
    if (saved) writeDraft(user.id, null);
    else writeDraft(user.id, rows);
  }, [user, loading, saved, rows]);

  function groupSubjects(list: Subject[]) {
    const map = new Map<string, Subject[]>();
    for (const s of list) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return [...map.entries()];
  }

  const subjectNameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects) {
      map.set(s.name.toLowerCase().trim(), s.id);
    }
    return map;
  }, [subjects]);

  function update(key: string, patch: Partial<Row>) {
    setSaved(false);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setSaved(false);
    setRows((prev) => (prev.length === 1 ? [newRow()] : prev.filter((r) => r.key !== key)));
  }

  function validate(filled: Row[]) {
    const next: Record<string, string> = {};
    const seen = new Set<string>();

    for (const row of rows) {
      const hasSubject = Boolean(row.subjectId);
      const hasMark = row.mark.trim() !== "";
      if (!hasSubject && !hasMark) continue;

      if (!hasSubject) next[row.key] = "Please choose a subject for this mark.";
      else if (!hasMark) next[row.key] = "Please enter a mark for this subject.";
      else if (!/^\d{1,3}(\.\d+)?$/.test(row.mark.trim()))
        next[row.key] = "Marks must be a number, like 72.";
      else {
        const value = Number(row.mark);
        if (Number.isNaN(value) || value < 0 || value > 100)
          next[row.key] = "Marks must be between 0 and 100.";
      }

      if (hasSubject) {
        if (seen.has(row.subjectId)) next[row.key] = "You've already added this subject.";
        seen.add(row.subjectId);
      }
    }

    if (Object.keys(next).length === 0 && filled.length === 0)
      setFormError("Add at least one subject and mark before saving.");

    setErrors(next);
    return Object.keys(next).length === 0 && filled.length > 0;
  }

  async function handleSave() {
    setFormError("");
    setSaved(false);
    const filled = rows.filter((r) => r.subjectId && r.mark.trim() !== "");
    if (!user || !validate(filled)) return;
    setSaving(true);
    try {
      await saveMyResults(
        user.id,
        filled.map((r) => ({ subjectId: r.subjectId, mark: Number(r.mark) })),
      );
      setSaved(true);
    } catch {
      setFormError("We couldn't save your results. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const completed = rows.filter((r) => r.subjectId && r.mark.trim() !== "").length;

  function handleExtracted(extracted: ExtractedSubject[]) {
    if (extracted.length === 0) return;
    const seen = new Set<string>();
    const nextRows = extracted
      .map((s) => {
        let subjectId = s.subject_id ?? "";
        if (!subjectId && s.subject_name_raw) {
          subjectId = subjectNameToId.get(s.subject_name_raw.toLowerCase().trim()) ?? "";
        }
        return newRow(subjectId, s.percentage != null ? String(s.percentage) : "");
      })
      .filter((r) => {
        if (!r.subjectId) return true;
        if (seen.has(r.subjectId)) return false;
        seen.add(r.subjectId);
        return true;
      });
    setRows(nextRows);
    setExtractionNotice(
      `We found ${extracted.length} subject${extracted.length === 1 ? "" : "s"} in your document and added them below for you to review.`,
    );
    setSaved(false);
    setFormError("");
  }

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-3xl px-6 py-14 md:py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Your results
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight">
          Add your <span className="italic text-primary">NSC subjects</span> and marks.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Add as many subjects as you took — there's no fixed number. You can come back and edit
          these at any time.
        </p>

        {user ? (
          <div className="mt-8">
            <ResultsDocumentUpload userId={user.id} onExtracted={handleExtracted} />
          </div>
        ) : null}

        <div className="mt-8 rounded-[2rem] border border-border bg-card p-6 md:p-8">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading your results…</p>
          ) : (
            <div className="space-y-5">
              <FormMessage>{formError}</FormMessage>
              {extractionNotice ? (
                <FormMessage tone="success">{extractionNotice}</FormMessage>
              ) : null}
              {saved ? (
                <FormMessage tone="success">
                  Your results are saved. {completed} subject{completed === 1 ? "" : "s"} recorded.
                </FormMessage>
              ) : null}

              {rows.map((row, index) => (
                <div key={row.key} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      Subject {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Remove subject ${index + 1}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <SelectField
                      id={`subject-${row.key}`}
                      label="Subject"
                      placeholder="Choose a subject"
                      value={row.subjectId}
                      onChange={(e) => update(row.key, { subjectId: e.target.value })}
                      options={[]}
                    >
                      <option value="">Choose a subject</option>
                      {grouped.map(([category, list]) => (
                        <optgroup key={category} label={category}>
                          {list.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </SelectField>

                    <TextField
                      id={`mark-${row.key}`}
                      label="Mark (%)"
                      inputMode="decimal"
                      placeholder="72"
                      value={row.mark}
                      onChange={(e) => update(row.key, { mark: e.target.value })}
                    />
                  </div>

                  {errors[row.key] ? (
                    <p className="mt-2 text-sm text-destructive">{errors[row.key]}</p>
                  ) : row.mark.trim() !== "" && Number(row.mark) >= 0 && Number(row.mark) <= 100 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Achievement level {achievementLevelForMark(Number(row.mark))}
                    </p>
                  ) : null}
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  setSaved(false);
                  setRows((prev) => [...prev, newRow()]);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add another subject
              </button>

              {!saved ? (
                <ActionButton size="block" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save my results"}
                </ActionButton>
              ) : null}

              {saved ? (
                <Link
                  to="/profile"
                  className="block rounded-2xl border border-border px-6 py-3.5 text-center text-base font-bold transition-colors hover:bg-secondary"
                >
                  Continue to my profile
                </Link>
              ) : null}

              <p className="text-center text-xs text-muted-foreground">
                Marks must be between 0 and 100, and each subject can only be added once. Only you
                can see your results.
              </p>
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

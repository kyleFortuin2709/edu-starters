import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ActionButton } from "@/components/ActionButton";
import { GenerationProgress } from "@/components/GenerationProgress";
import { fetchAdminCourses, type AdminCourse } from "@/lib/admin";
import { RIASEC_META, RIASEC_ORDER, type RiasecDimension } from "@/lib/career";
import {
  fetchCourseRiasecProfiles,
  saveCourseRiasecProfile,
  setCourseRiasecReviewed,
  topDimensions,
  type CourseRiasecProfile,
} from "@/lib/course-riasec";
import { generateCourseRiasecProfiles } from "@/lib/course-riasec.functions";

export const Route = createFileRoute("/_authenticated/admin/interest-profiles")({
  head: () => ({
    meta: [
      { title: "Course interest profiles — EduStarter" },
      {
        name: "description",
        content: "Generate and review the RIASEC interest profile behind each course recommendation.",
      },
      { property: "og:title", content: "Course interest profiles — EduStarter" },
      {
        property: "og:description",
        content: "Manage the interest profiles that power EduStarter course recommendations.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InterestProfilesPage,
});

const BATCH_SIZE = 20;

function InterestProfilesPage() {
  const generate = useServerFn(generateCourseRiasecProfiles);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [profiles, setProfiles] = useState<Map<string, CourseRiasecProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<RiasecDimension, number> | null>(null);
  const [progress, setProgress] = useState<{
    total: number;
    processed: number;
    currentBatch: number;
    totalBatches: number;
    label: string;
  } | null>(null);

  const load = () =>
    Promise.all([fetchAdminCourses(), fetchCourseRiasecProfiles()])
      .then(([c, p]) => {
        setCourses(c);
        setProfiles(p);
        setLoading(false);
      })
      .catch(() => {
        setError("We couldn't load the interest profiles. Please refresh the page.");
        setLoading(false);
      });

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missing = useMemo(
    () => courses.filter((c) => !profiles.has(c.id)),
    [courses, profiles],
  );
  const unapproved = useMemo(
    () => courses.filter((c) => profiles.get(c.id) && !profiles.get(c.id)!.isReviewed),
    [courses, profiles],
  );
  const approvedCount = useMemo(
    () => courses.filter((c) => profiles.get(c.id)?.isReviewed).length,
    [courses, profiles],
  );

  const setApproval = async (courseIds: string[], reviewed: boolean) => {
    if (courseIds.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await setCourseRiasecReviewed(courseIds, reviewed);
      await load();
      setStatus(
        reviewed
          ? `${courseIds.length} profile${courseIds.length === 1 ? "" : "s"} approved — students will see these recommendations.`
          : "Approval removed.",
      );
    } catch {
      setError("We couldn't update the approval status.");
    } finally {
      setBusy(false);
    }
  };

  const runGeneration = async (targets: AdminCourse[]) => {
    if (targets.length === 0) return;
    setBusy(true);
    setError("");
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE);
    setProgress({
      total: targets.length,
      processed: 0,
      currentBatch: 1,
      totalBatches,
      label: `Preparing to generate ${targets.length} profile${targets.length === 1 ? "" : "s"}`,
    });
    let saved = 0;
    try {
      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const batch = targets.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                currentBatch: batchNumber,
                label: `Generating profiles ${i + 1}–${i + batch.length} of ${targets.length}`,
              }
            : prev,
        );
        const result = await generate({ data: { courseIds: batch.map((c) => c.id) } });
        if (!result.ok) {
          setError(result.error ?? "Generation failed.");
          break;
        }
        saved += result.saved;
        setProgress((prev) => (prev ? { ...prev, processed: saved } : prev));
      }
      setStatus(`${saved} profile${saved === 1 ? "" : "s"} saved.`);
      await load();
    } catch {
      setError("Generation failed. Please try again.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const startEdit = (courseId: string) => {
    const existing = profiles.get(courseId);
    const base = {} as Record<RiasecDimension, number>;
    for (const dim of RIASEC_ORDER) base[dim] = existing?.scores[dim] ?? 0;
    setEditing(courseId);
    setDraft(base);
  };

  const saveEdit = async () => {
    if (!editing || !draft) return;
    setBusy(true);
    try {
      await saveCourseRiasecProfile({
        courseId: editing,
        scores: draft,
        notes: profiles.get(editing)?.notes ?? null,
        isReviewed: profiles.get(editing)?.isReviewed ?? false,
      });
      setEditing(null);
      setDraft(null);
      await load();
      setStatus("Profile updated.");
    } catch {
      setError("We couldn't save that profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">
        Course interest profiles
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Each course needs an interest profile before students see personalised recommendations.
        Generate them from the course name, faculty and description, then adjust anything that looks
        wrong. Interest profiles never affect eligibility, APS or entry requirements — only the
        ordering and match labels inside each result group.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-[2rem] border border-border bg-card p-6">
        <div className="mr-auto">
          <p className="font-mono text-xs uppercase text-muted-foreground">Coverage</p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {courses.length - missing.length} of {courses.length} courses
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {approvedCount} approved for recommendations · {unapproved.length} awaiting approval
          </p>
        </div>
        <ActionButton
          onClick={() => void setApproval(unapproved.map((c) => c.id), true)}
          disabled={busy || unapproved.length === 0}
        >
          Approve all ({unapproved.length})
        </ActionButton>
        <ActionButton
          variant="outline"
          onClick={() => void runGeneration(missing)}
          disabled={busy || missing.length === 0}
        >
          Generate missing ({missing.length})
        </ActionButton>
        <ActionButton
          variant="outline"
          onClick={() => void runGeneration(courses)}
          disabled={busy || courses.length === 0}
        >
          Regenerate all
        </ActionButton>
      </div>

      {progress ? (
        <GenerationProgress
          total={progress.total}
          processed={progress.processed}
          currentBatch={progress.currentBatch}
          totalBatches={progress.totalBatches}
          label={progress.label}
        />
      ) : status ? (
        <p className="mt-4 text-sm text-muted-foreground">{status}</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading courses…</p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-[2rem] border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border font-mono text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Course</th>
                <th className="px-6 py-4">Profile</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const profile = profiles.get(course.id);
                const isEditing = editing === course.id;
                return (
                  <tr key={course.id} className="border-b border-border/60 align-top last:border-0">
                    <td className="px-6 py-4">
                      <p className="font-semibold">{course.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[course.universities?.name, course.faculties?.name]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {isEditing && draft ? (
                        <div className="grid grid-cols-3 gap-3">
                          {RIASEC_ORDER.map((dim) => (
                            <label key={dim} className="font-mono text-[11px] uppercase">
                              {RIASEC_META[dim].name}
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={draft[dim]}
                                onChange={(e) =>
                                  setDraft({ ...draft, [dim]: Number(e.target.value) })
                                }
                                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm"
                              />
                            </label>
                          ))}
                        </div>
                      ) : profile ? (
                        <>
                          <p className="font-mono text-xs">
                            {topDimensions(profile.scores, 2)
                              .map((d) => `${RIASEC_META[d].name} ${profile.scores[d]}%`)
                              .join(" · ")}
                          </p>
                          <p
                            className={`mt-1 font-mono text-[11px] uppercase ${
                              profile.isReviewed ? "text-primary" : "text-warning"
                            }`}
                          >
                            {profile.isReviewed ? "Approved" : "Awaiting approval"}
                          </p>
                          {profile.notes ? (
                            <p className="mt-1 max-w-md text-xs text-muted-foreground">
                              {profile.notes}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <span className="font-mono text-xs uppercase text-muted-foreground">
                          Not generated
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <ActionButton size="sm" onClick={() => void saveEdit()} disabled={busy}>
                            Save
                          </ActionButton>
                          <ActionButton
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(null);
                              setDraft(null);
                            }}
                          >
                            Cancel
                          </ActionButton>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {profile ? (
                            <ActionButton
                              size="sm"
                              variant="outline"
                              onClick={() => void setApproval([course.id], !profile.isReviewed)}
                              disabled={busy}
                            >
                              {profile.isReviewed ? "Unapprove" : "Approve"}
                            </ActionButton>
                          ) : null}
                          <ActionButton
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(course.id)}
                          >
                            Edit
                          </ActionButton>
                          <ActionButton
                            size="sm"
                            variant="outline"
                            onClick={() => void runGeneration([course])}
                            disabled={busy}
                          >
                            Generate
                          </ActionButton>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

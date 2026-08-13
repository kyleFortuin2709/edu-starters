import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  applyFacultyToGroup,
  createFaculty,
  fetchFaculties,
  groupByFaculty,
  publishFaculty,
  type Faculty,
} from "@/lib/faculties";
import type { StagedCourse } from "@/lib/prospectus";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { PublicationPill } from "@/components/StatusPill";

type Props = {
  prospectusId: string;
  universityId: string | null;
  staged: StagedCourse[];
  onStagedUpdated: (courseIds: string[], facultyName: string) => void;
};

/**
 * Step 2 of the review workflow: sort the scraped courses by the faculty
 * wording the AI found, then map each wording onto one standardised faculty
 * for this institution — an existing record or a new one.
 */
export function FacultyReviewCard({ prospectusId, universityId, staged, onStagedUpdated }: Props) {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    if (!universityId) {
      setFaculties([]);
      return;
    }
    fetchFaculties(universityId)
      .then((rows) => active && setFaculties(rows))
      .catch(() => active && setError("We couldn't load this institution's faculties."));
    return () => {
      active = false;
    };
  }, [universityId]);

  const groups = groupByFaculty(staged, faculties);

  const notLiveCount = groups.filter((g) => {
    const f = g.match;
    return !f || f.publication_status !== "published" || !f.is_active;
  }).length;

  async function apply(key: string, group: (typeof groups)[number]) {
    if (!universityId) return;
    setError("");
    setMessage("");
    setBusyKey(key);
    try {
      const selected = choice[key] ?? group.match?.id ?? "";
      let faculty: Faculty | undefined;
      if (selected === "__new__" || (!selected && !group.match)) {
        const name = (newName[key] ?? group.scraped ?? "").trim();
        if (!name) throw new Error("Give the new faculty a name.");
        faculty = await createFaculty(universityId, name);
        setFaculties((prev) => [...prev, faculty!].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        faculty = faculties.find((f) => f.id === selected) ?? group.match ?? undefined;
      }
      if (!faculty) throw new Error("Choose a faculty to file these courses under.");

      const ids = group.courses.filter((c) => c.status !== "published").map((c) => c.id);
      await applyFacultyToGroup({ prospectusId, courseIds: ids, facultyName: faculty.name });
      onStagedUpdated(ids, faculty.name);
      setMessage(
        `${ids.length} staged course${ids.length === 1 ? "" : "s"} filed under ${faculty.name}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "That faculty couldn't be applied.");
    } finally {
      setBusyKey("");
    }
  }

  async function publish(faculty: Faculty) {
    setBusyKey(faculty.id);
    try {
      await publishFaculty(faculty.id);
      setFaculties((prev) =>
        prev.map((f) => (f.id === faculty.id ? { ...f, publication_status: "published", is_active: true } : f)),
      );
      setMessage(`${faculty.name} is now published.`);
    } catch {
      setError("That faculty couldn't be published.");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div
      className={`mt-10 rounded-[2rem] border bg-card p-6 md:p-8 ${
        collapsed && notLiveCount > 0 ? "border-warning/50 bg-warning/5" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Step 2 · Faculties</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {notLiveCount > 0 ? (
              <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning-foreground">
                {notLiveCount} facult{notLiveCount === 1 ? "y" : "ies"} not live
              </span>
            ) : (
              groups.length > 0 && (
                <span className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  All faculties live
                </span>
              )
            )}
            <span className="text-xs text-muted-foreground">
              {groups.length} group{groups.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand faculties" : "Collapse faculties"}
          className="rounded-full border border-border p-2 hover:bg-secondary"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {collapsed ? null : !universityId ? (
        <>
      <p className="mt-4 text-sm text-muted-foreground">
        Courses are grouped by the faculty wording found in the document. File each group under an
        existing faculty or create a new one — nothing reaches students until it is published.
      </p>
        <p className="mt-6 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
          Register or link the institution in Step 1 first — faculties belong to an institution.
        </p>
        </>
      ) : staged.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
          No staged courses yet, so there is nothing to sort into faculties.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            Courses are grouped by the faculty wording found in the document. File each group under
            an existing faculty or create a new one — nothing reaches students until it is
            published.
          </p>
          {error && (
            <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </p>
          )}
          {message && !error && (
            <p className="mt-4 rounded-2xl border border-success/30 bg-success/5 p-4 text-sm text-success">
              {message}
            </p>
          )}

          <div className="mt-6 space-y-4">
            {groups.map((group, index) => {
              const key = group.scraped ?? `__none__${index}`;
              const selected = choice[key] ?? group.match?.id ?? (group.scraped ? "__new__" : "");
              const chosenFaculty = faculties.find((f) => f.id === selected) ?? null;
              const isLive =
                !!group.match && group.match.publication_status === "published" && group.match.is_active;
              const open = openGroups[key] ?? !isLive;
              return (
                <article
                  key={key}
                  className={`rounded-2xl border bg-background p-5 ${
                    isLive ? "border-border" : "border-warning/50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {group.scraped ?? "No faculty found in the document"}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {group.courses.length} course{group.courses.length === 1 ? "" : "s"} ·{" "}
                        {group.match
                          ? `Matches existing faculty "${group.match.name}"`
                          : "No matching faculty yet"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {chosenFaculty && <PublicationPill status={chosenFaculty.publication_status} />}
                      {!isLive && (
                        <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning-foreground">
                          Not live
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [key]: !open }))}
                        aria-expanded={open}
                        aria-label={open ? "Collapse faculty group" : "Expand faculty group"}
                        className="rounded-full border border-border p-1.5 hover:bg-secondary"
                      >
                        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {open && (
                  <>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {group.courses.slice(0, 6).map((c) => (
                      <li
                        key={c.id}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                      >
                        {c.name}
                      </li>
                    ))}
                    {group.courses.length > 6 && (
                      <li className="px-2 py-1 text-xs text-muted-foreground">
                        +{group.courses.length - 6} more
                      </li>
                    )}
                  </ul>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <SelectField
                      id={`faculty-choice-${index}`}
                      label="Standardised faculty"
                      value={selected}
                      onChange={(e) => setChoice((prev) => ({ ...prev, [key]: e.target.value }))}
                      options={[]}
                    >
                      <option value="">Choose a faculty…</option>
                      {faculties.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                          {f.publication_status === "draft" ? " (draft)" : ""}
                        </option>
                      ))}
                      <option value="__new__">+ Create a new faculty</option>
                    </SelectField>

                    {selected === "__new__" && (
                      <TextField
                        id={`faculty-new-${index}`}
                        label="New faculty name"
                        value={newName[key] ?? group.scraped ?? ""}
                        onChange={(e) => setNewName((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="e.g. Faculty of Science"
                      />
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyKey === key}
                      onClick={() => apply(key, group)}
                      className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
                    >
                      {busyKey === key ? "Applying…" : "Apply to these courses"}
                    </button>
                    {chosenFaculty && chosenFaculty.publication_status === "draft" && (
                      <button
                        type="button"
                        disabled={busyKey === chosenFaculty.id}
                        onClick={() => publish(chosenFaculty)}
                        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
                      >
                        Publish faculty
                      </button>
                    )}
                  </div>
                  </>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

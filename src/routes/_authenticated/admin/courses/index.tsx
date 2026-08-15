import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminCourses,
  fetchAdminUniversities,
  updateCourse,
  type AdminCourse,
  type AdminUniversity,
} from "@/lib/admin";
import { SelectField } from "@/components/SelectField";
import { ActivePill, PublicationPill, StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/_authenticated/admin/courses/")({
  head: () => ({
    meta: [
      { title: "Courses — EduStarter admin" },
      { name: "description", content: "Manage course records, status and publication state." },
      { property: "og:title", content: "Courses — EduStarter admin" },
      { property: "og:description", content: "Manage EduStarter course records." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCoursesPage,
});

function AdminCoursesPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [universities, setUniversities] = useState<AdminUniversity[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchAdminCourses(), fetchAdminUniversities()])
      .then(([c, u]) => {
        if (!active) return;
        setCourses(c);
        setUniversities(u);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't load the courses. Please refresh the page.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      courses.filter((c) => {
        if (universityId && c.university_id !== universityId) return false;
        if (status === "published" && c.publication_status !== "published") return false;
        if (status === "draft" && c.publication_status !== "draft") return false;
        if (status === "active" && !c.is_active) return false;
        if (status === "inactive" && c.is_active) return false;
        return true;
      }),
    [courses, universityId, status],
  );

  async function patch(course: AdminCourse, changes: Parameters<typeof updateCourse>[1]) {
    setBusyId(course.id);
    setError("");
    try {
      await updateCourse(course.id, changes);
      setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, ...changes } : c)));
    } catch {
      setError("That change couldn't be saved. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section>
      <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">Courses</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Only live and active courses are shown to students. Drafts and inactive courses stay hidden
        until you change their status.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <SelectField
          id="filter-university"
          label="University"
          placeholder="All universities"
          value={universityId}
          onChange={(e) => setUniversityId(e.target.value)}
          options={universities.map((u) => ({ value: u.id, label: u.name }))}
        />
        <SelectField
          id="filter-status"
          label="Status"
          placeholder="All statuses"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "published", label: "Live (published)" },
            { value: "draft", label: "Draft" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </div>

      {error && (
        <p className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading courses…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No courses match these filters.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {filtered.map((course) => (
            <article
              key={course.id}
              className="rounded-[1.75rem] border border-border bg-card p-6 md:flex md:items-center md:justify-between md:gap-6"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl font-semibold">{course.name}</h2>
                  <PublicationPill status={course.publication_status} />
                  <ActivePill active={course.is_active} />
                  {course.is_demo && <StatusPill tone="demo">Unverified data</StatusPill>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[
                    course.universities?.name,
                    course.faculties?.name,
                    course.qualification_types?.name,
                    course.aps_requirement != null ? `APS ${course.aps_requirement}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 md:mt-0 md:shrink-0">
                <button
                  type="button"
                  disabled={busyId === course.id}
                  onClick={() =>
                    patch(course, {
                      publication_status:
                        course.publication_status === "published" ? "draft" : "published",
                    })
                  }
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
                >
                  {course.publication_status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  disabled={busyId === course.id}
                  onClick={() => patch(course, { is_active: !course.is_active })}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
                >
                  {course.is_active ? "Deactivate" : "Activate"}
                </button>
                <Link
                  to="/admin/courses/$courseId"
                  params={{ courseId: course.id }}
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-primary"
                >
                  Edit
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

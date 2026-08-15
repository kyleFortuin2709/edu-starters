import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  fetchAdminCourse,
  fetchAdminFaculties,
  updateCourse,
  type AdminCourseDetail,
  type AdminFaculty,
  type AdminRequirementRule,
} from "@/lib/admin";
import { fetchQualificationTypes, type QualificationType } from "@/lib/catalogue";
import { fetchSubjects, type Subject } from "@/lib/results";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { ActionButton } from "@/components/ActionButton";
import { ActivePill, PublicationPill, StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/_authenticated/admin/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Edit course — EduStarter admin" },
      { name: "description", content: "Edit course details, status and publication state." },
      { property: "og:title", content: "Edit course — EduStarter admin" },
      { property: "og:description", content: "Edit an EduStarter course record." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCourseEditPage,
});

type FormState = {
  name: string;
  code: string;
  description: string;
  duration_years: string;
  aps_requirement: string;
  application_url: string;
  faculty_id: string;
  qualification_type_id: string;
  is_active: boolean;
  publication_status: "draft" | "published";
};

function toForm(course: AdminCourseDetail): FormState {
  return {
    name: course.name,
    code: course.code ?? "",
    description: course.description ?? "",
    duration_years: course.duration_years?.toString() ?? "",
    aps_requirement: course.aps_requirement?.toString() ?? "",
    application_url: course.application_url ?? "",
    faculty_id: course.faculty_id ?? "",
    qualification_type_id: course.qualification_type_id ?? "",
    is_active: course.is_active,
    publication_status: course.publication_status,
  };
}

function AdminCourseEditPage() {
  const { courseId } = useParams({ from: "/_authenticated/admin/courses/$courseId" });
  const [course, setCourse] = useState<AdminCourseDetail | null>(null);
  const [faculties, setFaculties] = useState<AdminFaculty[]>([]);
  const [qualifications, setQualifications] = useState<QualificationType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchAdminCourse(courseId),
      fetchAdminFaculties(),
      fetchQualificationTypes(),
      fetchSubjects(),
    ])
      .then(([c, f, q, s]) => {
        if (!active) return;
        setCourse(c);
        setForm(c ? toForm(c) : null);
        setFaculties(f);
        setQualifications(q);
        setSubjects(s);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't load this course. Please refresh the page.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId]);

  const subjectName = useMemo(() => {
    const map = new Map(subjects.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Unknown subject") : "Unknown subject");
  }, [subjects]);

  const facultyOptions = useMemo(
    () =>
      faculties
        .filter((f) => !course || f.university_id === course.university_id)
        .map((f) => ({ value: f.id, label: f.name })),
    [faculties, course],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || !course) return;
    setMessage("");
    setError("");

    if (!form.name.trim()) {
      setError("A course needs a name.");
      return;
    }
    const aps = form.aps_requirement.trim();
    if (aps && (!/^\d+$/.test(aps) || Number(aps) < 0 || Number(aps) > 100)) {
      setError("The APS requirement must be a whole number between 0 and 100.");
      return;
    }
    const duration = form.duration_years.trim();
    if (duration && (Number.isNaN(Number(duration)) || Number(duration) <= 0)) {
      setError("Duration must be a positive number of years.");
      return;
    }

    setSaving(true);
    try {
      const patch = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        duration_years: duration ? Number(duration) : null,
        aps_requirement: aps ? Number(aps) : null,
        application_url: form.application_url.trim() || null,
        faculty_id: form.faculty_id || null,
        qualification_type_id: form.qualification_type_id || null,
        is_active: form.is_active,
        publication_status: form.publication_status,
      };
      await updateCourse(course.id, patch);
      setCourse({ ...course, ...patch });
      setMessage("Course saved.");
    } catch {
      setError("We couldn't save this course. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="mt-10 text-sm text-muted-foreground">Loading course…</p>;
  if (!course || !form)
    return (
      <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {error || "This course could not be found."}{" "}
        <Link to="/admin/courses" className="font-semibold text-primary underline-offset-4 hover:underline">
          Back to courses
        </Link>
      </div>
    );

  return (
    <section className="mt-8">
      <Link
        to="/admin/courses"
        className="font-semibold text-primary underline-offset-4 hover:underline"
      >
        ← Back to courses
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{course.name}</h1>
        <PublicationPill status={course.publication_status} />
        <ActivePill active={course.is_active} />
        {course.is_demo && <StatusPill tone="demo">Unverified data</StatusPill>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {[course.universities?.name, course.faculties?.name].filter(Boolean).join(" · ")}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 rounded-[2rem] border border-border bg-card p-8">
        <h2 className="font-display text-2xl font-semibold">Course details</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <TextField
            id="name"
            label="Course name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <TextField
            id="code"
            label="Course code"
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
          />
          <SelectField
            id="faculty"
            label="Faculty"
            placeholder="No faculty"
            value={form.faculty_id}
            onChange={(e) => set("faculty_id", e.target.value)}
            options={facultyOptions}
          />
          <SelectField
            id="qualification"
            label="Qualification type"
            placeholder="No qualification type"
            value={form.qualification_type_id}
            onChange={(e) => set("qualification_type_id", e.target.value)}
            options={qualifications.map((q) => ({ value: q.id, label: q.name }))}
          />
          <TextField
            id="aps"
            label="Minimum APS requirement"
            inputMode="numeric"
            value={form.aps_requirement}
            onChange={(e) => set("aps_requirement", e.target.value)}
          />
          <TextField
            id="duration"
            label="Duration (years)"
            inputMode="decimal"
            value={form.duration_years}
            onChange={(e) => set("duration_years", e.target.value)}
          />
          <TextField
            id="url"
            label="Application URL"
            value={form.application_url}
            onChange={(e) => set("application_url", e.target.value)}
            className="md:col-span-2"
          />
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="description" className="text-sm font-semibold text-foreground">
              Description
            </label>
            <textarea
              id="description"
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <SelectField
            id="publication"
            label="Publication state"
            value={form.publication_status}
            onChange={(e) => set("publication_status", e.target.value as "draft" | "published")}
            options={[
              { value: "draft", label: "Draft — hidden from students" },
              { value: "published", label: "Live — visible to students" },
            ]}
          />
          <SelectField
            id="active"
            label="Course status"
            value={form.is_active ? "active" : "inactive"}
            onChange={(e) => set("is_active", e.target.value === "active")}
            options={[
              { value: "active", label: "Active — offered" },
              { value: "inactive", label: "Inactive — not offered" },
            ]}
          />
        </div>

        {error && <p className="mt-6 text-sm font-semibold text-destructive">{error}</p>}
        {message && <p className="mt-6 text-sm font-semibold text-success">{message}</p>}

        <div className="mt-8">
          <ActionButton type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </ActionButton>
        </div>
      </form>

      <div className="mt-8 rounded-[2rem] border border-border bg-card p-8">
        <h2 className="font-display text-2xl font-semibold">Entry requirements</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Requirements are read-only for now. APS requirements and subject percentage requirements
          are stored separately and evaluated separately by the eligibility engine.
        </p>
        {course.course_requirement_sets.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No requirement sets have been captured for this course.
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            {course.course_requirement_sets.map((set_) => (
              <div key={set_.id} className="rounded-2xl border border-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{set_.name}</h3>
                  <ActivePill active={set_.is_active} />
                </div>
                {set_.min_aps != null && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Minimum APS for this set: <strong>{set_.min_aps}</strong>
                  </p>
                )}
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {set_.course_requirement_rules.map((rule) => (
                    <li key={rule.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[0.65rem] uppercase tracking-wide text-foreground">
                        {rule.is_required ? "Required" : "Optional"}
                      </span>
                      <span>{describeRule(rule, subjectName)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function describeRule(
  rule: AdminRequirementRule,
  subjectName: (id: string | null) => string,
): string {
  if (rule.description) return rule.description;
  switch (rule.rule_type) {
    case "min_aps":
      return `Minimum APS of ${rule.min_aps ?? "—"}`;
    case "subject_min_percentage":
      return `${subjectName(rule.subject_id)} at ${rule.min_percentage ?? "—"}% or higher`;
    case "subject_min_level":
      return `${subjectName(rule.subject_id)} at achievement level ${rule.min_achievement_level ?? "—"} or higher`;
    case "one_of_subjects_min_percentage":
      return `Any one of ${rule.subject_ids.map((id) => subjectName(id)).join(", ")} at ${rule.min_percentage ?? "—"}% or higher`;
    case "one_of_subjects_min_level":
      return `Any one of ${rule.subject_ids.map((id) => subjectName(id)).join(", ")} at achievement level ${rule.min_achievement_level ?? "—"} or higher`;
    case "min_subject_count":
      return `At least ${rule.min_count ?? "—"} qualifying subjects`;
    default:
      return rule.rule_type;
  }
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  buildOverview,
  fetchAdminCourses,
  fetchAdminFaculties,
  fetchAdminUniversities,
  type AdminOverview,
} from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — EduStarter" },
      { name: "description", content: "Manage EduStarter university, faculty and course data." },
      { property: "og:title", content: "Admin overview — EduStarter" },
      { property: "og:description", content: "Manage EduStarter catalogue data." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchAdminUniversities(), fetchAdminFaculties(), fetchAdminCourses()])
      .then(([u, f, c]) => {
        if (active) setOverview(buildOverview(u, f, c));
      })
      .catch(() => {
        if (active) setError("We couldn't load the catalogue overview. Please refresh the page.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section>
      <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">Catalogue overview</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Live data is visible to students. Draft data stays hidden from students until it is
        published, so you can prepare records safely.
      </p>

      {error ? (
        <p className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {error}
        </p>
      ) : !overview ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading catalogue…</p>
      ) : (
        <>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <StatCard
              label="Universities"
              total={overview.universities.total}
              published={overview.universities.published}
              draft={overview.universities.draft}
            />
            <StatCard
              label="Faculties"
              total={overview.faculties.total}
              published={overview.faculties.published}
              draft={overview.faculties.draft}
            />
            <StatCard
              label="Courses"
              total={overview.courses.total}
              published={overview.courses.published}
              draft={overview.courses.draft}
              extra={`${overview.courses.active} active · ${overview.courses.inactive} inactive`}
            />
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Link
              to="/admin/universities"
              className="rounded-[2rem] border border-border bg-card p-8 transition-colors hover:bg-secondary"
            >
              <h2 className="font-display text-2xl font-semibold">Universities & faculties</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Review every institution and its faculties, including drafts.
              </p>
            </Link>
            <Link
              to="/admin/courses"
              className="rounded-[2rem] border border-border bg-card p-8 transition-colors hover:bg-secondary"
            >
              <h2 className="font-display text-2xl font-semibold">Courses & requirements</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Edit course details, entry requirements, active status and publication state.
              </p>
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function StatCard({
  label,
  total,
  published,
  draft,
  extra,
}: {
  label: string;
  total: number;
  published: number;
  draft: number;
  extra?: string;
}) {
  return (
    <div className="rounded-[2rem] border border-border bg-card p-8">
      <span className="font-mono text-xs font-bold uppercase text-muted-foreground">{label}</span>
      <p className="mt-6 font-display text-4xl font-semibold">{total}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {published} live · {draft} draft
      </p>
      {extra && <p className="mt-1 text-sm text-muted-foreground">{extra}</p>}
    </div>
  );
}

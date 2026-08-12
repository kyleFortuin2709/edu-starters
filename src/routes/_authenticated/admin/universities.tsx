import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  fetchAdminFaculties,
  fetchAdminUniversities,
  type AdminFaculty,
  type AdminUniversity,
} from "@/lib/admin";
import { ActivePill, PublicationPill, StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/_authenticated/admin/universities")({
  head: () => ({
    meta: [
      { title: "Universities & faculties — EduStarter admin" },
      { name: "description", content: "Review every university and faculty record in EduStarter." },
      { property: "og:title", content: "Universities & faculties — EduStarter admin" },
      { property: "og:description", content: "Review institution and faculty records." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUniversitiesPage,
});

function AdminUniversitiesPage() {
  const [universities, setUniversities] = useState<AdminUniversity[]>([]);
  const [faculties, setFaculties] = useState<AdminFaculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchAdminUniversities(), fetchAdminFaculties()])
      .then(([u, f]) => {
        if (!active) return;
        setUniversities(u);
        setFaculties(f);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't load the institutions. Please refresh the page.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section>
      <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">
        Universities & faculties
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Read-only view of every institution, including records that are still drafts and therefore
        hidden from students.
      </p>

      {loading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading institutions…</p>
      ) : error ? (
        <p className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {error}
        </p>
      ) : universities.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No universities have been captured yet.
        </p>
      ) : (
        <div className="mt-10 space-y-6">
          {universities.map((uni) => {
            const uniFaculties = faculties.filter((f) => f.university_id === uni.id);
            return (
              <article key={uni.id} className="rounded-[2rem] border border-border bg-card p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-semibold">{uni.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[uni.short_name, uni.city, uni.provinces?.name].filter(Boolean).join(" · ") ||
                        "No location captured"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PublicationPill status={uni.publication_status} />
                    <ActivePill active={uni.is_active} />
                    {uni.is_demo && <StatusPill tone="demo">Demo data</StatusPill>}
                  </div>
                </div>

                <h3 className="mt-6 font-mono text-xs font-bold uppercase text-muted-foreground">
                  Faculties ({uniFaculties.length})
                </h3>
                {uniFaculties.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No faculties captured for this institution yet.
                  </p>
                ) : (
                  <ul className="mt-3 grid gap-3 md:grid-cols-2">
                    {uniFaculties.map((f) => (
                      <li
                        key={f.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3"
                      >
                        <span className="text-sm font-semibold">{f.name}</span>
                        <span className="flex gap-2">
                          <PublicationPill status={f.publication_status} />
                          <ActivePill active={f.is_active} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

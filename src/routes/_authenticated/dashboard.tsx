import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ActionButton } from "@/components/ActionButton";
import { useAuth } from "@/lib/auth";
import { fetchMyProfile, isProfileComplete, type StudentProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — EduStarter" },
      { name: "description", content: "Track your NSC results and university course matches in one place." },
      { property: "og:title", content: "Your dashboard — EduStarter" },
      { property: "og:description", content: "Track your NSC results and university course matches in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

const tiers = [
  { label: "You Qualify", tone: "bg-success", note: "Requirements met" },
  { label: "Almost Qualify", tone: "bg-warning", note: "Within reach" },
  { label: "Don't Qualify", tone: "bg-muted-foreground", note: "Alternative pathways" },
];

function DashboardPage() {
  const { user, displayName } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchMyProfile(user.id)
      .then((data) => {
        if (!active) return;
        if (!isProfileComplete(data)) {
          navigate({ to: "/profile-setup", replace: true });
          return;
        }
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, navigate]);

  if (loading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-7xl px-6 py-24 text-sm text-muted-foreground">Loading…</div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Student dashboard
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              Hello, {profile?.first_name || displayName}.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Once your NSC results are added, your course matches will appear here grouped by status.
            </p>
          </div>
          <ActionButton size="lg" disabled>
            Add my results
          </ActionButton>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.label} className="rounded-[2rem] border border-border bg-card p-8">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${tier.tone}`} aria-hidden="true" />
                <span className="font-mono text-xs font-bold uppercase">{tier.label}</span>
              </div>
              <p className="mt-6 font-display text-4xl font-semibold">—</p>
              <p className="mt-2 text-sm text-muted-foreground">{tier.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid place-items-center rounded-[2rem] bg-surface-muted p-12 text-center md:p-20">
          <div className="mb-4 grid size-16 place-items-center rounded-full bg-card shadow-sm">
            <div className="size-8 rounded-lg border-2 border-dashed border-border" />
          </div>
          <h2 className="font-display text-xl font-semibold">No results added yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Course matching is coming soon. Your saved marks, matched degrees and application tracking will
            all live in this space.
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}

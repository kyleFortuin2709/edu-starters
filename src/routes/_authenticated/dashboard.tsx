import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ActionButton } from "@/components/ActionButton";
import { useAuth } from "@/lib/auth";
import { fetchMyProfile, isProfileComplete, type StudentProfile } from "@/lib/profile";
import { countMyResults } from "@/lib/results";
import { ToleranceSettingsCard } from "@/components/ToleranceSettingsCard";
import { ApsScoresCard } from "@/components/ApsScoresCard";

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

function DashboardPage() {
  const { user, displayName } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [subjectCount, setSubjectCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([fetchMyProfile(user.id), countMyResults(user.id)])
      .then(([data, count]) => {
        if (!active) return;
        if (!isProfileComplete(data)) {
          navigate({ to: "/profile-setup", replace: true });
          return;
        }
        setProfile(data);
        setSubjectCount(count);
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
              This is your home base. Keep your NSC subjects and marks up to date here.
            </p>
          </div>
          <Link to="/results">
            <ActionButton size="lg">
              {subjectCount > 0 ? "Edit my results" : "Add my results"}
            </ActionButton>
          </Link>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-[2rem] border border-border bg-card p-8">
            <span className="font-mono text-xs font-bold uppercase text-muted-foreground">
              Subjects entered
            </span>
            <p className="mt-6 font-display text-4xl font-semibold">{subjectCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">NSC subjects with a mark saved.</p>
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-8">
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${subjectCount > 0 ? "bg-success" : "bg-muted-foreground"}`}
                aria-hidden="true"
              />
              <span className="font-mono text-xs font-bold uppercase">Results status</span>
            </div>
            <p className="mt-6 font-display text-2xl font-semibold">
              {subjectCount > 0 ? "Results saved" : "Not started"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {subjectCount > 0
                ? "You can edit or add subjects at any time."
                : "Add your subjects and marks to get started."}
            </p>
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-8">
            <span className="font-mono text-xs font-bold uppercase text-muted-foreground">Next step</span>
            <p className="mt-6 text-sm text-muted-foreground">
              {subjectCount > 0
                ? "See how your results compare with the entry requirements of the demo courses in the catalogue."
                : "Add your subjects and marks first, then we can compare them with course entry requirements."}
            </p>
            {subjectCount > 0 ? (
              <Link
                to="/matches"
                className="mt-4 inline-block font-semibold text-primary underline-offset-4 hover:underline"
              >
                View my course matches →
              </Link>
            ) : (
              <Link
                to="/results"
                className="mt-4 inline-block font-semibold text-primary underline-offset-4 hover:underline"
              >
                Add my results →
              </Link>
            )}
            <Link
              to="/saved"
              className="mt-3 block font-semibold text-primary underline-offset-4 hover:underline"
            >
              View my saved courses →
            </Link>
          </div>
        </div>

        {user && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <ApsScoresCard userId={user.id} />
            <ToleranceSettingsCard userId={user.id} profile={profile} />
            <div className="rounded-[2rem] border border-border bg-card p-8">
              <span className="font-mono text-xs font-bold uppercase text-muted-foreground">
                How APS will work
              </span>
              <p className="mt-4 text-sm text-muted-foreground">
                There is no single universal APS score. Each institution's APS calculation rule is
                stored separately, so the same NSC results can produce different APS scores
                depending on which rule applies. Only a clearly labelled{" "}
                <strong>DEMO / UNVERIFIED</strong> rule exists so far.
              </p>
            </div>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

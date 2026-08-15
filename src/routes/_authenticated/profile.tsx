import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookMarked, Compass, FileText } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ActionButton } from "@/components/ActionButton";
import { useAuth } from "@/lib/auth";
import { fetchMyProfile, type StudentProfile } from "@/lib/profile";
import { countMyResults } from "@/lib/results";
import { useSavedCourses } from "@/lib/saved-courses-context";
import {
  RIASEC_META,
  RIASEC_ORDER,
  fetchMyCareerProfile,
  type CareerProfileResult,
  type RiasecDimension,
} from "@/lib/career";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — EduStarter" },
      {
        name: "description",
        content: "Your EduStarter student profile: your results, saved courses and direction profile.",
      },
      { property: "og:title", content: "My profile — EduStarter" },
      {
        property: "og:description",
        content: "Manage your NSC results, saved courses and interest profile.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, displayName } = useAuth();
  const { savedIds } = useSavedCourses();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [subjectCount, setSubjectCount] = useState(0);
  const [career, setCareer] = useState<CareerProfileResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      fetchMyProfile(user.id),
      countMyResults(user.id),
      fetchMyCareerProfile(user.id).catch(() => null),
    ])
      .then(([data, count, careerProfile]) => {
        if (!active) return;
        setProfile(data);
        setSubjectCount(count);
        setCareer(careerProfile?.completedAt ? careerProfile : null);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || displayName || "Student";

  const topThree = career
    ? ([...RIASEC_ORDER].sort(
        (a, b) => career.percentages[b] - career.percentages[a],
      ) as RiasecDimension[]).slice(0, 3)
    : [];

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">My profile</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">{fullName}</h1>
        <p className="mt-3 text-muted-foreground">
          {loading ? "Loading your profile…" : user?.email}
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] border border-border bg-card p-8">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="size-6" />
            </div>
            <h2 className="mt-6 font-display text-xl font-semibold">My results</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {subjectCount > 0
                ? `${subjectCount} NSC subject${subjectCount === 1 ? "" : "s"} saved.`
                : "You haven't added any NSC subjects yet."}
            </p>
            <Link to="/results" className="mt-6 inline-block">
              <ActionButton variant="outline">
                {subjectCount > 0 ? "Edit my results" : "Add my results"}
              </ActionButton>
            </Link>
          </div>

          <div className="rounded-[2rem] border border-border bg-card p-8">
            <div className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
              <BookMarked className="size-6" />
            </div>
            <h2 className="mt-6 font-display text-xl font-semibold">Saved courses</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {savedIds.size > 0
                ? `${savedIds.size} course${savedIds.size === 1 ? "" : "s"} on your shortlist.`
                : "You haven't saved any courses yet."}
            </p>
            <Link to="/saved" className="mt-6 inline-block">
              <ActionButton variant="outline">See saved courses</ActionButton>
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-[2rem] border border-border bg-card p-8">
          <div className="grid size-12 place-items-center rounded-2xl bg-warning/10 text-warning">
            <Compass className="size-6" />
          </div>
          <h2 className="mt-6 font-display text-xl font-semibold">Find Your Direction</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            An optional questionnaire — no right or wrong answers — that shows the kinds of work that fit
            you best. It never changes your course matches or APS scores.
          </p>

          {career && (
            <div className="mt-6 flex flex-wrap gap-2">
              {topThree.map((dimension) => (
                <span
                  key={dimension}
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${RIASEC_META[dimension].accent}`}
                >
                  {RIASEC_META[dimension].name} {Math.round(career.percentages[dimension])}%
                </span>
              ))}
            </div>
          )}

          <Link to="/direction" className="mt-6 inline-block">
            <ActionButton size="lg">
              {career ? "View my direction profile" : "Find Your Direction"}
            </ActionButton>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ActionButton } from "@/components/ActionButton";
import { useAuth } from "@/lib/auth";
import {
  RIASEC_META,
  RIASEC_ORDER,
  fetchCareerQuestions,
  fetchMyCareerProfile,
  fetchMyCareerResponses,
  saveCareerResponse,
  submitCareerQuestionnaire,
  type CareerProfileResult,
  type CareerQuestion,
  type RiasecDimension,
} from "@/lib/career";

export const Route = createFileRoute("/_authenticated/direction")({
  head: () => ({
    meta: [
      { title: "Find Your Direction — EduStarter" },
      {
        name: "description",
        content:
          "An optional interest questionnaire that shows your six-dimension RIASEC profile. There are no right or wrong answers.",
      },
      { property: "og:title", content: "Find Your Direction — EduStarter" },
      {
        property: "og:description",
        content: "Answer a few questions and see the kind of work that fits you best.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DirectionPage,
});

function DirectionPage() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<CareerQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CareerProfileResult | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([fetchCareerQuestions(), fetchMyCareerResponses(user.id), fetchMyCareerProfile(user.id)])
      .then(([q, a, p]) => {
        if (!active) return;
        setQuestions(q);
        setAnswers(a);
        setResult(p && p.completedAt ? p : null);
        const firstUnanswered = q.findIndex((item) => !a[item.id]);
        setIndex(firstUnanswered === -1 ? Math.max(0, q.length - 1) : firstUnanswered);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message ?? "We couldn't load the questionnaire.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const current = questions[index];
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id]).length,
    [questions, answers],
  );
  const isLast = index === questions.length - 1;

  async function choose(optionId: string) {
    if (!user || !current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: optionId }));
    setError("");
    try {
      await saveCareerResponse({ profileId: user.id, questionId: current.id, optionId });
    } catch (err: any) {
      setError(err?.message ?? "We couldn't save that answer.");
      return;
    }
    if (!isLast) setIndex((i) => i + 1);
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      await submitCareerQuestionnaire(user.id);
      const profile = await fetchMyCareerProfile(user.id);
      setResult(profile);
      setShowQuestions(false);
    } catch (err: any) {
      setError(err?.message ?? "We couldn't work out your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-6 py-24 text-sm text-muted-foreground">Loading…</div>
      </SiteLayout>
    );
  }

  if (result && !showQuestions) {
    return (
      <SiteLayout>
        <ResultView
          result={result}
          onRetake={() => {
            setShowQuestions(true);
            setIndex(0);
          }}
        />
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Find Your Direction
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
          There are no right or wrong answers.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Just pick the option that sounds most like you. This is optional and it does not affect your
          course matches or APS scores in any way.
        </p>

        {/* Progress */}
        <div className="mt-10">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              Question {index + 1} of {questions.length}
            </span>
            <span>{answeredCount} answered</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${questions.length ? ((index + 1) / questions.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {current && (
          <div className="mt-8 rounded-[2rem] border border-border bg-card p-8">
            <h2 className="font-display text-2xl font-semibold leading-snug">{current.prompt}</h2>
            <div className="mt-6 flex flex-col gap-3">
              {current.options.map((option) => {
                const selected = answers[current.id] === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => choose(option.id)}
                    className={
                      "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors " +
                      (selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/40 hover:bg-secondary")
                    }
                  >
                    <span
                      className={
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border font-mono text-xs font-bold " +
                        (selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground")
                      }
                    >
                      {option.option_label}
                    </span>
                    <span className="text-sm text-foreground">{option.option_text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <ActionButton
            variant="outline"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            <ArrowLeft className="mr-2 size-4" /> Back
          </ActionButton>

          <div className="flex items-center gap-3">
            {!isLast && (
              <ActionButton
                variant="outline"
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              >
                Next <ArrowRight className="ml-2 size-4" />
              </ActionButton>
            )}
            <ActionButton
              onClick={finish}
              disabled={saving || answeredCount === 0}
              title={answeredCount === 0 ? "Answer at least one question first" : undefined}
            >
              {saving ? "Working it out…" : "See my profile"}
            </ActionButton>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          You can leave at any time — your answers are saved as you go.{" "}
          <Link to="/profile" className="font-semibold text-primary underline-offset-4 hover:underline">
            Back to my profile
          </Link>
        </p>
      </section>
    </SiteLayout>
  );
}

function ResultView({ result, onRetake }: { result: CareerProfileResult; onRetake: () => void }) {
  const ranked = [...RIASEC_ORDER].sort(
    (a, b) => result.percentages[b] - result.percentages[a],
  ) as RiasecDimension[];
  const top = ranked.slice(0, 3);

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Your direction profile
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
        You lean towards {top.map((d) => RIASEC_META[d].name).join(", ")}.
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Based on {result.totalAnswered} answers. This is a guide to the kind of work that may suit you —
        it does not change your course matches or APS scores.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {ranked.map((dimension) => {
          const meta = RIASEC_META[dimension];
          const percent = Math.round(result.percentages[dimension]);
          return (
            <div key={dimension} className={`rounded-[2rem] border p-6 ${meta.accent}`}>
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">{meta.name}</h2>
                  <p className="font-mono text-xs uppercase tracking-widest">{meta.tagline}</p>
                </div>
                <span className="font-display text-3xl font-semibold text-foreground">{percent}%</span>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-background/60">
                <div className="h-full rounded-full bg-current" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-4 text-sm text-foreground/80">{meta.description}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap gap-4">
        <ActionButton variant="outline" onClick={onRetake}>
          <Sparkles className="mr-2 size-4" /> Review or change my answers
        </ActionButton>
        <Link to="/matches">
          <ActionButton>See my course matches</ActionButton>
        </Link>
      </div>
    </section>
  );
}

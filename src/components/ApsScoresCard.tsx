import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { fetchMyApsByUniversity, type UniversityApsScore } from "@/lib/aps-scores";

const STATUS_LABEL: Record<string, string> = {
  demo: "Provisional",
  unverified: "Unverified",
  verified: "Verified",
};

export function ApsScoresCard({ userId }: { userId: string }) {
  const [scores, setScores] = useState<UniversityApsScore[]>([]);
  const [hasResults, setHasResults] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetchMyApsByUniversity(userId)
      .then((data) => {
        if (!active) return;
        setScores(data.scores);
        setHasResults(data.hasResults);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div className="rounded-[2rem] border border-border bg-card p-8">
      <span className="font-mono text-xs font-bold uppercase text-muted-foreground">
        Your APS per institution
      </span>
      <p className="mt-3 text-sm text-muted-foreground">
        There is no single APS score. Each institution's calculation rule is applied to the same NSC
        results, so scores differ per university.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Calculating…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-muted-foreground">
          We couldn't work out your APS scores right now. Please refresh the page.
        </p>
      ) : !hasResults ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Add your NSC subjects and marks first —{" "}
          <Link to="/results" className="font-semibold text-primary underline-offset-4 hover:underline">
            add my results
          </Link>
          .
        </p>
      ) : scores.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No institutions are published yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {scores.map((score) => (
            <li key={score.universityId} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {score.shortName || score.universityName}
                </p>
                <p className="truncate font-mono text-xs uppercase text-muted-foreground">
                  {score.calculation
                    ? `${score.calculation.ruleName} · ${STATUS_LABEL[score.calculation.ruleStatus] ?? score.calculation.ruleStatus}`
                    : "No APS rule linked yet"}
                </p>
              </div>
              <span className="shrink-0 font-display text-2xl font-semibold">
                {score.calculation ? score.calculation.totalAps : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

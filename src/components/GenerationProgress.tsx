import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

const STAGES = [
  { label: "Preparing course batch", seconds: 3 },
  { label: "Analysing course names and faculties", seconds: 12 },
  { label: "Scoring RIASEC dimensions", seconds: 10 },
  { label: "Saving profiles to the database", seconds: 4 },
];

const TOTAL_STAGE_SECONDS = STAGES.reduce((sum, s) => sum + s.seconds, 0);

export function GenerationProgress({
  total,
  processed,
  currentBatch,
  totalBatches,
  label,
}: {
  total: number;
  processed: number;
  currentBatch: number;
  totalBatches: number;
  label?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => window.clearInterval(id);
  }, []);

  const actualPercent = total > 0 ? (processed / total) * 100 : 0;
  // Blend actual progress with a gentle stage-based pulse so the bar never feels frozen.
  const stagePulse = Math.min(95, (1 - Math.exp(-elapsed / (TOTAL_STAGE_SECONDS / 1.8))) * 100);
  const percent = Math.max(5, Math.min(95, actualPercent * 0.85 + stagePulse * 0.15));

  let cursor = 0;
  let activeIndex = STAGES.length - 1;
  for (let i = 0; i < STAGES.length; i += 1) {
    cursor += STAGES[i]!.seconds;
    if (elapsed < cursor) {
      activeIndex = i;
      break;
    }
  }

  return (
    <div className="mt-4 animate-fade-in rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-warning animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            {label ?? `Generating profiles batch ${currentBatch} of ${totalBatches}`}
          </p>
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            {processed} of {total} courses completed
          </p>
        </div>
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
        <span>{Math.round(percent)}% complete</span>
        <span>{Math.round(elapsed)}s elapsed</span>
      </div>

      <ul className="mt-5 space-y-2.5">
        {STAGES.map((stage, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li
              key={stage.label}
              className={
                active
                  ? "flex items-center gap-2.5 text-sm font-medium text-foreground"
                  : done
                    ? "flex items-center gap-2.5 text-sm text-muted-foreground"
                    : "flex items-center gap-2.5 text-sm text-muted-foreground/50"
              }
            >
              {done ? (
                <Check className="h-4 w-4 shrink-0 text-success" />
              ) : active ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border border-border" />
              )}
              {stage.label}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Large catalogues are processed in batches of 20. You can leave this page open — nothing is
        published until you approve the profiles.
      </p>
    </div>
  );
}

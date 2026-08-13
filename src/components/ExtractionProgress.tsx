import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * Extraction runs as one server call, so exact progress isn't reported back.
 * This shows the reader's stages moving forward so an admin can see what the
 * document reader is working on instead of a frozen button.
 */
const STAGES = [
  { label: "Opening the document", seconds: 4 },
  { label: "Reading pages", seconds: 16 },
  { label: "Identifying the institution", seconds: 8 },
  { label: "Finding courses and requirements", seconds: 22 },
  { label: "Looking for APS methodology", seconds: 10 },
  { label: "Staging records for review", seconds: 8 },
];

const TOTAL = STAGES.reduce((sum, s) => sum + s.seconds, 0);

export function ExtractionProgress({ fileName }: { fileName?: string | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => window.clearInterval(id);
  }, []);

  // Ease towards 95% so the bar never claims completion before the server answers.
  const percent = Math.min(95, (1 - Math.exp(-elapsed / (TOTAL / 2.2))) * 100);

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
    <div className="mt-4 rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="text-sm font-semibold">Reading {fileName ?? "the document"}</p>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
        {Math.round(percent)}% · {Math.round(elapsed)}s elapsed
      </p>

      <ul className="mt-4 space-y-2">
        {STAGES.map((stage, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li
              key={stage.label}
              className={
                active
                  ? "flex items-center gap-2 text-sm font-medium text-foreground"
                  : done
                    ? "flex items-center gap-2 text-sm text-muted-foreground"
                    : "flex items-center gap-2 text-sm text-muted-foreground/60"
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

      <p className="mt-3 text-xs text-muted-foreground">
        Large prospectuses can take a few minutes. You can leave this page open — nothing reaches
        the live catalogue automatically.
      </p>
    </div>
  );
}
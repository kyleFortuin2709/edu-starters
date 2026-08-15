import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import { RichText } from "@/components/RichText";
import { askCourseAdvisor } from "@/lib/course-advisor.functions";
import { STATUS_LABEL, describeCheck } from "@/lib/eligibility-format";
import type { CourseEligibilityView } from "@/lib/eligibility-view";
import { useAuth } from "@/lib/auth";
import {
  fetchConversation,
  saveConversation,
  type AdvisorTurn,
} from "@/lib/advisor-conversations";

const SUGGESTIONS = [
  "Why do I get this result?",
  "What am I missing?",
  "Explain my APS for this course",
  "What careers could this lead to?",
];

/**
 * Builds the ONLY data the AI sees: this course, its requirements, the
 * student's relevant marks and the engine's verdict. Nothing else is sent.
 */
function buildContext(course: CourseEligibilityView, description: string | null): string {
  const checks = course.bestSet?.checks ?? [];
  const lines = [
    `Course: ${course.courseName}`,
    `University: ${course.universityName ?? "unknown"}`,
    `Faculty: ${course.facultyName ?? "unknown"}`,
    `Province: ${course.provinceName ?? "unknown"}`,
    `Qualification: ${course.qualificationName ?? "unknown"}`,
    description ? `Description: ${description}` : "Description: not available",
    course.isDemoCourse ? "NOTE: this course data has not been verified against the institution." : "",
    "",
    `Eligibility status (decided by the deterministic engine, not by you): ${STATUS_LABEL[course.status]}`,
    `Student APS for this institution: ${course.studentAps ?? "not available"}`,
    `Required APS: ${course.requiredAps ?? "not stated"}`,
    course.apsGap != null ? `APS shortfall: ${course.apsGap} points` : "",
    `APS calculation rule used: ${course.apsCalculation?.ruleName ?? "none linked"}`,
    "",
    "Requirement checks:",
    ...(checks.length
      ? checks.map(
          (c) =>
            `- ${c.description} | required: ${c.required ?? "n/a"} | student: ${c.actual ?? "unknown"} | outcome: ${c.outcome}${
              c.gap != null ? ` | short by ${c.gap}` : ""
            } | ${describeCheck(c)}`,
        )
      : ["- No published entry requirements for this course."]),
    "",
    "Student subject marks used:",
    ...(course.apsCalculation?.subjects ?? []).map(
      (s) => `- ${s.subjectName ?? "Subject"}: ${s.mark}% (${s.counted ? `${s.points} pts` : s.reason})`,
    ),
    "",
    "Engine notes:",
    ...(course.notes.length ? course.notes.map((n) => `- ${n}`) : ["- none"]),
  ];
  return lines.filter(Boolean).join("\n");
}

type Turn = AdvisorTurn;

export function CourseAdvisor({
  course,
  description,
}: {
  course: CourseEligibilityView;
  description: string | null;
}) {
  const ask = useServerFn(askCourseAdvisor);
  const { user } = useAuth();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchConversation(user.id, course.courseId)
      .then((stored) => {
        if (active && stored.length) setTurns(stored);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, course.courseId]);

  function persist(next: Turn[]) {
    if (!user) return;
    void saveConversation(user.id, course.courseId, next).catch(() => {});
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setError("");
    setQuestion("");
    const history = turns.slice(-6);
    setTurns((prev) => [...prev, { role: "user", content: trimmed }]);
    setPending(true);
    try {
      const result = await ask({
        data: { question: trimmed, context: buildContext(course, description), history },
      });
      if (result.ok) {
        setTurns((prev) => {
          const next: Turn[] = [...prev, { role: "assistant" as const, content: result.answer }];
          persist(next);
          return next;
        });
      } else {
        setError(result.error);
      }
    } catch {
      setError("We couldn't reach the AI advisor. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 rounded-[2rem] border border-border bg-card p-8">
      <span className="font-mono text-xs uppercase text-muted-foreground">AI course advisor</span>
      <h2 className="mt-3 font-display text-2xl font-semibold">Ask about this course</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Ask why you got this result, what's missing, or where this course could lead. The advisor
        explains your existing eligibility result — it never changes it, and eligibility is not a
        guarantee of admission.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void send(s)}
            disabled={pending}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {turns.length > 0 && (
        <ul className="mt-6 space-y-4">
          {turns.map((turn, index) => (
            <li
              key={index}
              className={
                turn.role === "user"
                  ? "rounded-2xl bg-muted px-4 py-3 text-sm font-medium"
                  : "rounded-2xl border border-border px-4 py-3 text-sm"
              }
            >
              {turn.role === "assistant" ? <RichText content={turn.content} /> : turn.content}
            </li>
          ))}
          {pending && <li className="px-4 text-sm text-muted-foreground">Thinking…</li>}
        </ul>
      )}

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void send(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question about this course…"
          aria-label="Ask a question about this course"
          maxLength={2000}
          className="w-full flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
        />
        <ActionButton type="submit" disabled={pending || !question.trim()}>
          {pending ? "Asking…" : "Ask"}
        </ActionButton>
      </form>

      {error ? (
        <div className="mt-4">
          <FormMessage>{error}</FormMessage>
        </div>
      ) : null}
    </div>
  );
}

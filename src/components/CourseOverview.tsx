import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FormMessage } from "@/components/FormMessage";
import { RichText } from "@/components/RichText";
import { getCourseOverview } from "@/lib/course-overview.functions";

type Career = { title: string; description: string };

export function CourseOverview({
  courseName,
  qualificationName,
  facultyName,
  description,
}: {
  courseName: string;
  qualificationName: string | null;
  facultyName: string | null;
  description: string | null;
}) {
  const load = useServerFn(getCourseOverview);
  const [summary, setSummary] = useState("");
  const [careers, setCareers] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    load({ data: { courseName, qualificationName, facultyName, description } })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setSummary(result.summary);
          setCareers(result.careers);
        } else {
          setError(result.error);
        }
      })
      .catch(() => {
        if (active) setError("We couldn't generate an overview right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseName, qualificationName, facultyName, description]);

  return (
    <>
      <div className="mt-6 rounded-[2rem] border border-border bg-card p-8">
        <span className="font-mono text-xs uppercase text-muted-foreground">AI overview</span>
        <h2 className="mt-3 font-display text-2xl font-semibold">What this course is about</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Writing a plain-language summary…</p>
        ) : error ? (
          <div className="mt-4">
            <FormMessage>{error}</FormMessage>
          </div>
        ) : (
          <>
            <div className="mt-4 max-w-3xl text-sm">
              <RichText content={summary} />
            </div>
            <p className="mt-4 font-mono text-[0.65rem] uppercase text-muted-foreground">
              AI-generated general guidance · always check the official prospectus
            </p>
          </>
        )}
      </div>

      {!loading && !error && careers.length > 0 && (
        <div className="mt-6 rounded-[2rem] border border-border bg-card p-8">
          <span className="font-mono text-xs uppercase text-muted-foreground">Career ideas</span>
          <h2 className="mt-3 font-display text-2xl font-semibold">Where this could lead</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {careers.map((career, index) => (
              <li key={career.title} className="rounded-2xl border border-border p-5">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-sm font-semibold">{career.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{career.description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 font-mono text-[0.65rem] uppercase text-muted-foreground">
            Examples only · not a guarantee of employment
          </p>
        </div>
      )}
    </>
  );
}

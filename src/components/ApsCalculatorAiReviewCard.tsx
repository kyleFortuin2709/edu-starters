import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import { StatusPill } from "@/components/StatusPill";
import { ApsCalculatorForm } from "@/components/ApsCalculatorForm";
import { fetchFaculties, type Faculty } from "@/lib/faculties";
import {
  approveApsCalculator,
  archiveApsCalculator,
  CALCULATION_TYPE_LABELS,
  fetchApsCalculators,
  type ApsCalculator,
  type ApsResolutionMethod,
} from "@/lib/aps-calculators-api";

type Props = {
  prospectusId: string;
  universityId: string | null;
  resolutionMethod?: ApsResolutionMethod;
  /** Render the card even when the extraction found nothing. */
  showWhenEmpty?: boolean;
  /** Allow adding extra calculators by hand from inside this card. */
  allowAdding?: boolean;
  title?: string;
};

/**
 * Review the APS rules the prospectus extraction suggested. Nothing here goes
 * live automatically: a suggestion becomes an active calculator only when an
 * admin accepts it.
 */
export function ApsCalculatorAiReviewCard({
  prospectusId,
  universityId,
  resolutionMethod = "HIGHEST_APPLICABLE",
  showWhenEmpty = false,
  allowAdding = false,
  title = "Detected APS rules",
}: Props) {
  const [suggestions, setSuggestions] = useState<ApsCalculator[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const rows = await fetchApsCalculators({ prospectusId, includeArchived: false });
    setSuggestions(rows.filter((r) => r.source !== "manual" && r.status !== "active"));
    if (universityId) setFaculties(await fetchFaculties(universityId));
  }, [prospectusId, universityId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .then(() => active && setLoading(false))
      .catch(() => {
        if (!active) return;
        setError("We couldn't load the detected APS rules.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function run(id: string, action: () => Promise<void>, note: string) {
    setBusyId(id);
    setError("");
    try {
      await action();
      await load();
      setMessage(note);
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action didn't work.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return showWhenEmpty ? (
    <div className="mt-10 rounded-[2rem] border border-border bg-card p-6 md:p-8 text-sm text-muted-foreground">
      Loading detected APS rules…
    </div>
  ) : null;
  if (suggestions.length === 0 && !showWhenEmpty) return null;

  return (
    <div
      className={`mt-10 rounded-[2rem] border p-6 md:p-8 ${
        suggestions.length > 0 ? "border-warning/50 bg-warning/5" : "border-border bg-card"
      }`}
    >
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {suggestions.length > 0
          ? `The extraction found ${suggestions.length} possible APS rule${
              suggestions.length === 1 ? "" : "s"
            } in this prospectus. Nothing is used until you accept it and confirm.`
          : "The extraction didn't find any APS rules in this prospectus. You can add a calculator by hand."}
      </p>

      <ul className="mt-6 space-y-4">
        {suggestions.map((s) => (
          <li key={s.id} className="rounded-2xl border border-border bg-card p-5">
            {editingId === s.id && universityId ? (
              <ApsCalculatorForm
                universityId={universityId}
                faculties={faculties}
                calculator={s}
                resolutionMethod={resolutionMethod}
                onResolutionMethodChange={() => undefined}
                onSaved={async () => {
                  setEditingId(null);
                  await load();
                  setMessage("Suggestion updated. Accept it when you're happy.");
                }}
                onCancel={() => setEditingId(null)}
                submitLabel="Save suggestion"
              />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    {s.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone="demo">
                      {s.source === "ai_suggested" ? "AI suggested" : "AI edited"}
                    </StatusPill>
                    {s.confidence != null && (
                      <StatusPill tone={s.confidence >= 0.7 ? "active" : "draft"}>
                        {Math.round(s.confidence * 100)}% confidence
                      </StatusPill>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <div>
                    <dt className="font-mono text-[0.65rem] uppercase text-muted-foreground">
                      Calculation type
                    </dt>
                    <dd className="mt-1 font-medium">
                      {CALCULATION_TYPE_LABELS[s.calculation_type]}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.65rem] uppercase text-muted-foreground">
                      Scope
                    </dt>
                    <dd className="mt-1 font-medium">
                      {s.scope === "GENERAL" ? "General" : "Faculty"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.65rem] uppercase text-muted-foreground">
                      Faculty
                    </dt>
                    <dd className="mt-1 font-medium">{s.faculty_name ?? "—"}</dd>
                  </div>
                </dl>

                {(s.source_evidence || s.ambiguity_notes) && (
                  <div className="mt-4 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    {s.source_evidence && (
                      <p>
                        <span className="font-semibold text-foreground">Source: </span>
                        {s.source_evidence}
                      </p>
                    )}
                    {s.ambiguity_notes && <p className="mt-2">{s.ambiguity_notes}</p>}
                  </div>
                )}

                {confirmId === s.id ? (
                  <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <p className="text-sm font-semibold">
                      Make “{s.name}” active for this institution?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton
                        type="button"
                        size="sm"
                        disabled={busyId === s.id}
                        onClick={() =>
                          run(s.id, () => approveApsCalculator(s.id), `“${s.name}” is now active.`)
                        }
                      >
                        Yes, activate
                      </ActionButton>
                      <ActionButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmId(null)}
                      >
                        Not yet
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton type="button" size="sm" onClick={() => setConfirmId(s.id)}>
                      Accept
                    </ActionButton>
                    <ActionButton
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!universityId}
                      onClick={() => setEditingId(s.id)}
                    >
                      Edit
                    </ActionButton>
                    <ActionButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busyId === s.id}
                      onClick={() =>
                        run(s.id, () => archiveApsCalculator(s.id), `“${s.name}” rejected.`)
                      }
                    >
                      Reject
                    </ActionButton>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-3">
        <FormMessage>{error}</FormMessage>
        {message && !error ? <FormMessage tone="success">{message}</FormMessage> : null}
      </div>

      {allowAdding && universityId ? (
        adding ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-xs font-bold uppercase text-muted-foreground">
              New calculator
            </p>
            <div className="mt-4">
              <ApsCalculatorForm
                universityId={universityId}
                faculties={faculties}
                resolutionMethod={resolutionMethod}
                onResolutionMethodChange={() => undefined}
                onSaved={async () => {
                  setAdding(false);
                  await load();
                  setMessage("Calculator added as a draft. Activate it when you're ready.");
                }}
                onCancel={() => setAdding(false)}
              />
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <ActionButton type="button" onClick={() => setAdding(true)}>
              Add another calculator
            </ActionButton>
          </div>
        )
      ) : null}
    </div>
  );
}

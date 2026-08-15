import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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
  groupApsCalculators,
  RESOLUTION_METHOD_LABELS,
  setApsCalculatorStatus,
  setInstitutionApsResolutionMethod,
  type ApsCalculator,
  type ApsResolutionMethod,
} from "@/lib/aps-calculators-api";

const db = supabase as unknown as SupabaseClient<any, "public", any>;

type Props = {
  universityId: string;
  /** Registration mode opens the form immediately and keeps copy short. */
  variant?: "registration" | "management";
  title?: string;
  defaultOpen?: boolean;
};

/**
 * Add, edit, activate and archive an institution's APS calculators.
 * Used both while registering an institution and afterwards for ongoing
 * management. All calculations stay in the backend.
 */
export function ApsCalculatorManager({
  universityId,
  variant = "management",
  title = "APS calculators",
  defaultOpen,
}: Props) {
  const [calculators, setCalculators] = useState<ApsCalculator[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [resolutionMethod, setResolutionMethod] =
    useState<ApsResolutionMethod>("HIGHEST_APPLICABLE");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ApsCalculator | null>(null);
  const [adding, setAdding] = useState(variant === "registration");
  const [collapsed, setCollapsed] = useState(!(defaultOpen ?? variant === "registration"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rows, facultyRows, uni] = await Promise.all([
      fetchApsCalculators({ universityId, includeArchived: true }),
      fetchFaculties(universityId),
      db.from("universities").select("aps_resolution_method").eq("id", universityId).maybeSingle(),
    ]);
    setCalculators(rows);
    setFaculties(facultyRows);
    if (uni.data?.aps_resolution_method) setResolutionMethod(uni.data.aps_resolution_method);
  }, [universityId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .then(() => active && setLoading(false))
      .catch(() => {
        if (!active) return;
        setError("We couldn't load the APS calculators for this institution.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function changeResolution(method: ApsResolutionMethod) {
    const previous = resolutionMethod;
    setResolutionMethod(method);
    try {
      await setInstitutionApsResolutionMethod(universityId, method);
      setMessage(`Resolution method set to “${RESOLUTION_METHOD_LABELS[method]}”.`);
    } catch {
      setResolutionMethod(previous);
      setError("We couldn't change the resolution method.");
    }
  }

  async function run(id: string, action: () => Promise<void>, note: string) {
    setBusyId(id);
    setError("");
    try {
      await action();
      await load();
      setMessage(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action didn't work.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = calculators.filter((c) => showArchived || c.status !== "archived");
  const groups = groupApsCalculators(visible);

  return (
    <div className="mt-8 rounded-[2rem] border border-border bg-card p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one or more calculators for this institution. Students only see active calculators,
            and the backend decides which one applies to each course.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          {collapsed ? "Open" : "Hide"}
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {collapsed ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {calculators.filter((c) => c.status === "active").length} active ·{" "}
          {calculators.filter((c) => c.status === "draft").length} draft
        </p>
      ) : loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading calculators…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-border bg-background p-4">
            <label
              htmlFor={`resolution-${universityId}`}
              className="text-sm font-semibold text-foreground"
            >
              Resolution method
            </label>
            <select
              id={`resolution-${universityId}`}
              value={resolutionMethod}
              onChange={(e) => void changeResolution(e.target.value as ApsResolutionMethod)}
              className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
            >
              {(Object.keys(RESOLUTION_METHOD_LABELS) as ApsResolutionMethod[]).map((m) => (
                <option key={m} value={m}>
                  {RESOLUTION_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          {groups.map((group) => (
            <div key={group.key}>
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              {group.calculators.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No calculators yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {group.calculators.map((calc) => (
                    <li key={calc.id} className="rounded-2xl border border-border p-4">
                      {editing?.id === calc.id ? (
                        <ApsCalculatorForm
                          universityId={universityId}
                          faculties={faculties}
                          calculator={calc}
                          resolutionMethod={resolutionMethod}
                          onResolutionMethodChange={changeResolution}
                          onSaved={async () => {
                            setEditing(null);
                            await load();
                            setMessage("Calculator updated.");
                          }}
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{calc.name}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {CALCULATION_TYPE_LABELS[calc.calculation_type]}
                                {calc.academic_year ? ` · ${calc.academic_year}` : ""}
                                {calc.description ? ` · ${calc.description}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <StatusPill
                                tone={
                                  calc.status === "active"
                                    ? "published"
                                    : calc.status === "draft"
                                      ? "draft"
                                      : "inactive"
                                }
                              >
                                {calc.status}
                              </StatusPill>
                              {calc.source !== "manual" && (
                                <StatusPill tone="demo">
                                  {calc.source === "ai_suggested" ? "AI suggested" : "AI edited"}
                                </StatusPill>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <ActionButton
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditing(calc)}
                            >
                              Edit
                            </ActionButton>
                            {calc.status !== "active" && (
                              <ActionButton
                                type="button"
                                size="sm"
                                disabled={busyId === calc.id}
                                onClick={() =>
                                  run(
                                    calc.id,
                                    () => approveApsCalculator(calc.id),
                                    `“${calc.name}” is now active.`,
                                  )
                                }
                              >
                                Activate
                              </ActionButton>
                            )}
                            {calc.status === "active" && (
                              <ActionButton
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busyId === calc.id}
                                onClick={() =>
                                  run(
                                    calc.id,
                                    () => setApsCalculatorStatus(calc.id, "draft"),
                                    `“${calc.name}” moved back to draft.`,
                                  )
                                }
                              >
                                Move to draft
                              </ActionButton>
                            )}
                            {calc.status !== "archived" && (
                              <ActionButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busyId === calc.id}
                                onClick={() =>
                                  run(
                                    calc.id,
                                    () => archiveApsCalculator(calc.id),
                                    `“${calc.name}” archived.`,
                                  )
                                }
                              >
                                Archive
                              </ActionButton>
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {adding ? (
            <div className="rounded-2xl border border-border bg-background p-5">
              <p className="font-mono text-xs font-bold uppercase text-muted-foreground">
                New calculator
              </p>
              <div className="mt-4">
                <ApsCalculatorForm
                  universityId={universityId}
                  faculties={faculties}
                  resolutionMethod={resolutionMethod}
                  onResolutionMethodChange={changeResolution}
                  onSaved={async () => {
                    await load();
                    setAdding(false);
                    setMessage("Calculator added as a draft. Activate it when you're ready.");
                  }}
                  onCancel={() => setAdding(false)}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <ActionButton type="button" onClick={() => setAdding(true)}>
                Add calculator
              </ActionButton>
              <ActionButton
                type="button"
                variant="outline"
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived ? "Hide archived" : "Show archived"}
              </ActionButton>
            </div>
          )}

          <FormMessage>{error}</FormMessage>
          {message && !error ? <FormMessage tone="success">{message}</FormMessage> : null}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  setUniversityApsRule,
  updateApsRule,
  type AdminUniversity,
  type ApsBandDraft,
} from "@/lib/admin";
import type { ApsCalculationRule } from "@/lib/aps";
import { ActionButton } from "@/components/ActionButton";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";

const EMPTY_BAND: ApsBandDraft = { min: "", max: "", points: "", label: "" };

function bandsOf(rule: ApsCalculationRule | undefined): ApsBandDraft[] {
  if (!rule) return [{ ...EMPTY_BAND }];
  const rows = [...rule.aps_point_bands].sort((a, b) => a.min_percentage - b.min_percentage);
  if (rows.length === 0) return [{ ...EMPTY_BAND }];
  return rows.map((b) => ({
    min: String(b.min_percentage),
    max: String(b.max_percentage),
    points: String(b.points),
    label: b.label ?? "",
  }));
}

/**
 * Lets an administrator choose which APS calculation rule a university uses and
 * edit that rule's percentage bands and counting settings.
 */
export function UniversityApsRuleCard({
  university,
  rules,
  onChanged,
}: {
  university: AdminUniversity;
  rules: ApsCalculationRule[];
  onChanged: (universityId: string, ruleId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ruleId, setRuleId] = useState(university.aps_rule_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selected = useMemo(() => rules.find((r) => r.id === ruleId), [rules, ruleId]);
  const [name, setName] = useState(selected?.name ?? "");
  const [version, setVersion] = useState(selected?.version ?? "v1");
  const [counting, setCounting] = useState(
    selected?.counting_subject_count != null ? String(selected.counting_subject_count) : "",
  );
  const [maxTotal, setMaxTotal] = useState(
    selected?.max_total_aps != null ? String(selected.max_total_aps) : "",
  );
  const [bands, setBands] = useState<ApsBandDraft[]>(() => bandsOf(selected));

  useEffect(() => {
    setName(selected?.name ?? "");
    setVersion(selected?.version ?? "v1");
    setCounting(
      selected?.counting_subject_count != null ? String(selected.counting_subject_count) : "",
    );
    setMaxTotal(selected?.max_total_aps != null ? String(selected.max_total_aps) : "");
    setBands(bandsOf(selected));
  }, [selected]);

  function setBand(index: number, key: keyof ApsBandDraft, value: string) {
    setBands((prev) => prev.map((b, i) => (i === index ? { ...b, [key]: value } : b)));
  }

  async function assign(nextId: string) {
    setRuleId(nextId);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await setUniversityApsRule(university.id, nextId || null);
      onChanged(university.id, nextId || null);
      setMessage(
        nextId
          ? "This university now scores students with the selected rule."
          : "APS rule removed from this university.",
      );
    } catch {
      setError("That change couldn't be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateApsRule(selected.id, {
        name: name.trim() || selected.name,
        version,
        description: selected.description,
        countingSubjectCount: counting.trim() ? Number(counting) : null,
        maxTotalAps: maxTotal.trim() ? Number(maxTotal) : null,
        bands,
      });
      onChanged(university.id, selected.id);
      setMessage("APS calculation updated. Student scores use it immediately.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That rule couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-background p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-mono text-xs font-bold uppercase text-muted-foreground">
          APS calculation
        </h3>
        <span className="text-sm font-semibold">
          {selected ? `${selected.name} · ${selected.version}` : "No rule assigned"}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Hide APS calculation editor" : "Change APS calculation"}
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          {open ? "Close" : "Change"}
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-5">
          <SelectField
            label="Rule used by this university"
            id={`aps-rule-${university.id}`}
            value={ruleId}
            disabled={busy}
            onChange={(e) => void assign(e.target.value)}
            placeholder="No rule assigned"
            options={rules.map((r) => ({
              value: r.id,
              label: `${r.name} (${r.version}) — ${r.status}`,
            }))}
          />

          {selected ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Rule name"
                  id={`aps-name-${university.id}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <TextField
                  label="Version"
                  id={`aps-version-${university.id}`}
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
                <TextField
                  label="Subjects counted"
                  id={`aps-count-${university.id}`}
                  type="number"
                  min={1}
                  max={12}
                  value={counting}
                  placeholder="e.g. 6"
                  onChange={(e) => setCounting(e.target.value)}
                />
                <TextField
                  label="Maximum total APS (optional)"
                  id={`aps-max-${university.id}`}
                  type="number"
                  min={1}
                  value={maxTotal}
                  placeholder="No cap"
                  onChange={(e) => setMaxTotal(e.target.value)}
                />
              </div>

              <div>
                <h4 className="text-sm font-semibold">Percentage bands</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Each band maps a mark range onto APS points.
                </p>
                <div className="mt-3 space-y-3">
                  {bands.map((band, index) => (
                    <div key={index} className="grid grid-cols-2 gap-3 md:grid-cols-9">
                      <input
                        aria-label="Minimum percentage"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                        placeholder="Min %"
                        value={band.min}
                        onChange={(e) => setBand(index, "min", e.target.value)}
                      />
                      <input
                        aria-label="Maximum percentage"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                        placeholder="Max %"
                        value={band.max}
                        onChange={(e) => setBand(index, "max", e.target.value)}
                      />
                      <input
                        aria-label="Points"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                        placeholder="Points"
                        value={band.points}
                        onChange={(e) => setBand(index, "points", e.target.value)}
                      />
                      <input
                        aria-label="Label"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                        placeholder="Label (optional)"
                        value={band.label}
                        onChange={(e) => setBand(index, "label", e.target.value)}
                      />
                      <button
                        type="button"
                        aria-label="Remove band"
                        onClick={() => setBands((prev) => prev.filter((_, i) => i !== index))}
                        className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2 text-muted-foreground hover:bg-secondary"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setBands((prev) => [...prev, { ...EMPTY_BAND }])}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
                >
                  <Plus className="h-4 w-4" /> Add band
                </button>
              </div>

              <ActionButton type="button" onClick={() => void save()} disabled={busy}>
                {busy ? "Saving…" : "Save APS calculation"}
              </ActionButton>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Assign a rule above to edit how this university scores students.
            </p>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          {message && !error && <p className="text-sm font-medium text-success">{message}</p>}
        </div>
      ) : null}
    </div>
  );
}

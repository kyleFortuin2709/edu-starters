import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { fetchSubjects, type Subject } from "@/lib/results";
import type { Faculty } from "@/lib/faculties";
import {
  CALCULATION_TYPE_LABELS,
  RESOLUTION_METHOD_LABELS,
  saveApsCalculator,
  type ApsCalculationType,
  type ApsCalculator,
  type ApsCalculatorConfiguration,
  type ApsCalculatorScope,
  type ApsResolutionMethod,
} from "@/lib/aps-calculators-api";

type Props = {
  universityId: string;
  faculties: Faculty[];
  calculator?: ApsCalculator | null;
  /** Institution-level setting, edited alongside the calculator. */
  resolutionMethod: ApsResolutionMethod;
  onResolutionMethodChange: (method: ApsResolutionMethod) => void | Promise<void>;
  onSaved: (calculator: ApsCalculator) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

const TYPES = Object.keys(CALCULATION_TYPE_LABELS) as ApsCalculationType[];

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * The single calculator form, reused during institution registration and in
 * the ongoing APS calculator management section. It only captures the record —
 * the backend performs every calculation.
 */
export function ApsCalculatorForm({
  universityId,
  faculties,
  calculator,
  resolutionMethod,
  onResolutionMethodChange,
  onSaved,
  onCancel,
  submitLabel,
}: Props) {
  const config = calculator?.configuration ?? {};
  const [name, setName] = useState(calculator?.name ?? "");
  const [description, setDescription] = useState(calculator?.description ?? "");
  const [calculationType, setCalculationType] = useState<ApsCalculationType>(
    calculator?.calculation_type ?? "BEST_N",
  );
  const [scope, setScope] = useState<ApsCalculatorScope>(calculator?.scope ?? "GENERAL");
  const [facultyId, setFacultyId] = useState(calculator?.faculty_id ?? "");
  const [academicYear, setAcademicYear] = useState(calculator?.academic_year ?? "");
  const [n, setN] = useState(config.n != null ? String(config.n) : "6");
  const [bonus, setBonus] = useState(config.bonus_points != null ? String(config.bonus_points) : "");
  const [maxTotal, setMaxTotal] = useState(config.max_total != null ? String(config.max_total) : "");
  const [defaultWeight, setDefaultWeight] = useState(
    config.default_weight != null ? String(config.default_weight) : "1",
  );
  const [excludeLo, setExcludeLo] = useState(Boolean(config.exclude_life_orientation));
  const [subjectIds, setSubjectIds] = useState<string[]>(config.subject_ids ?? []);
  const [requiredIds, setRequiredIds] = useState<string[]>(config.required_subject_ids ?? []);
  const [excludeIds, setExcludeIds] = useState<string[]>(config.exclude_subject_ids ?? []);
  const [weights, setWeights] = useState<{ subject_id: string; weight: number }[]>(
    config.weights ?? [],
  );
  const [customJson, setCustomJson] = useState(JSON.stringify(config ?? {}, null, 2));
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchSubjects()
      .then((rows) => active && setSubjects(rows))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const subjectName = useMemo(() => {
    const map = new Map(subjects.map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? "Subject";
  }, [subjects]);

  function buildConfiguration(): ApsCalculatorConfiguration | null {
    if (calculationType === "CUSTOM") {
      try {
        const parsed = customJson.trim() === "" ? {} : JSON.parse(customJson);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setError("Custom configuration must be a JSON object.");
          return null;
        }
        return parsed as ApsCalculatorConfiguration;
      } catch {
        setError("Custom configuration is not valid JSON.");
        return null;
      }
    }

    const cfg: ApsCalculatorConfiguration = {};
    if (calculationType !== "SPECIFIC_SUBJECTS") {
      const count = numberOrUndefined(n);
      if (count != null) cfg.n = count;
    }
    if (calculationType === "SPECIFIC_SUBJECTS" || calculationType === "BEST_N") {
      if (subjectIds.length > 0) cfg.subject_ids = subjectIds;
    }
    if (calculationType === "BEST_N_REQUIRED_SUBJECTS") {
      if (requiredIds.length > 0) cfg.required_subject_ids = requiredIds;
      if (subjectIds.length > 0) cfg.subject_ids = subjectIds;
    }
    if (calculationType === "WEIGHTED") {
      cfg.weights = weights.filter((w) => w.subject_id && Number.isFinite(w.weight));
      const dw = numberOrUndefined(defaultWeight);
      if (dw != null) cfg.default_weight = dw;
    }
    if (excludeIds.length > 0) cfg.exclude_subject_ids = excludeIds;
    if (excludeLo) cfg.exclude_life_orientation = true;
    const bonusPoints = numberOrUndefined(bonus);
    if (bonusPoints != null) cfg.bonus_points = bonusPoints;
    const cap = numberOrUndefined(maxTotal);
    if (cap != null) cfg.max_total = cap;
    return cfg;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Give the calculator a name.");
      return;
    }
    if (scope === "FACULTY" && !facultyId) {
      setError("Choose the faculty this calculator applies to.");
      return;
    }
    const configuration = buildConfiguration();
    if (!configuration) return;

    setBusy(true);
    try {
      const saved = await saveApsCalculator({
        id: calculator?.id ?? null,
        universityId,
        name,
        description,
        calculationType,
        scope,
        facultyId: facultyId || null,
        academicYear,
        configuration,
        status: calculator?.status ?? "draft",
        apsRuleId: calculator?.aps_rule_id ?? null,
        notes: calculator?.notes ?? null,
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save this calculator.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TextField
        id={`calc-name-${calculator?.id ?? "new"}`}
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="General APS"
      />

      <div className="space-y-1.5">
        <label
          htmlFor={`calc-desc-${calculator?.id ?? "new"}`}
          className="text-sm font-semibold text-foreground"
        >
          Description
        </label>
        <textarea
          id={`calc-desc-${calculator?.id ?? "new"}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          placeholder="How this institution adds up points."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id={`calc-type-${calculator?.id ?? "new"}`}
          label="Calculation type"
          value={calculationType}
          onChange={(e) => setCalculationType(e.target.value as ApsCalculationType)}
          options={TYPES.map((t) => ({ value: t, label: CALCULATION_TYPE_LABELS[t] }))}
        />
        <TextField
          id={`calc-year-${calculator?.id ?? "new"}`}
          label="Academic year"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="2026"
        />
      </div>

      <div className="rounded-2xl border border-border bg-background p-5">
        <p className="font-mono text-xs font-bold uppercase text-muted-foreground">Configuration</p>
        <div className="mt-4 space-y-4">
          {calculationType === "CUSTOM" ? (
            <div className="space-y-1.5">
              <label
                htmlFor={`calc-json-${calculator?.id ?? "new"}`}
                className="text-sm font-semibold text-foreground"
              >
                Custom configuration (JSON)
              </label>
              <textarea
                id={`calc-json-${calculator?.id ?? "new"}`}
                value={customJson}
                onChange={(e) => setCustomJson(e.target.value)}
                rows={8}
                spellCheck={false}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 font-mono text-xs focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              />
            </div>
          ) : (
            <>
              {calculationType !== "SPECIFIC_SUBJECTS" && (
                <TextField
                  id={`calc-n-${calculator?.id ?? "new"}`}
                  label="How many subjects count (N)"
                  type="number"
                  min={1}
                  max={12}
                  value={n}
                  onChange={(e) => setN(e.target.value)}
                />
              )}

              {calculationType === "SPECIFIC_SUBJECTS" && (
                <SubjectPicker
                  label="Subjects that count"
                  subjects={subjects}
                  selected={subjectIds}
                  onChange={setSubjectIds}
                />
              )}

              {calculationType === "BEST_N" && (
                <SubjectPicker
                  label="Limit to these subjects (optional)"
                  subjects={subjects}
                  selected={subjectIds}
                  onChange={setSubjectIds}
                />
              )}

              {calculationType === "BEST_N_REQUIRED_SUBJECTS" && (
                <>
                  <SubjectPicker
                    label="Always counted subjects"
                    subjects={subjects}
                    selected={requiredIds}
                    onChange={setRequiredIds}
                  />
                  <SubjectPicker
                    label="Limit remaining subjects to (optional)"
                    subjects={subjects}
                    selected={subjectIds}
                    onChange={setSubjectIds}
                  />
                </>
              )}

              {calculationType === "WEIGHTED" && (
                <div className="space-y-3">
                  <TextField
                    id={`calc-dw-${calculator?.id ?? "new"}`}
                    label="Default weight"
                    type="number"
                    step="0.1"
                    value={defaultWeight}
                    onChange={(e) => setDefaultWeight(e.target.value)}
                  />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Subject weights</p>
                    {weights.map((w, index) => (
                      <div key={index} className="flex flex-wrap items-end gap-2">
                        <select
                          value={w.subject_id}
                          onChange={(e) =>
                            setWeights((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, subject_id: e.target.value } : row,
                              ),
                            )
                          }
                          className="min-w-48 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                        >
                          <option value="">Choose subject</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.1"
                          value={w.weight}
                          onChange={(e) =>
                            setWeights((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, weight: Number(e.target.value) } : row,
                              ),
                            )
                          }
                          className="w-28 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                        />
                        <ActionButton
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setWeights((prev) => prev.filter((_, i) => i !== index))}
                        >
                          Remove
                        </ActionButton>
                      </div>
                    ))}
                    <ActionButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setWeights((prev) => [...prev, { subject_id: "", weight: 1 }])}
                    >
                      Add subject weight
                    </ActionButton>
                  </div>
                </div>
              )}

              <SubjectPicker
                label="Never counted subjects (optional)"
                subjects={subjects}
                selected={excludeIds}
                onChange={setExcludeIds}
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={excludeLo}
                  onChange={(e) => setExcludeLo(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Exclude Life Orientation
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  id={`calc-bonus-${calculator?.id ?? "new"}`}
                  label="Bonus points (optional)"
                  type="number"
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                />
                <TextField
                  id={`calc-max-${calculator?.id ?? "new"}`}
                  label="Maximum total (optional)"
                  type="number"
                  value={maxTotal}
                  onChange={(e) => setMaxTotal(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id={`calc-scope-${calculator?.id ?? "new"}`}
          label="Scope"
          value={scope}
          onChange={(e) => {
            const next = e.target.value as ApsCalculatorScope;
            setScope(next);
            if (next === "GENERAL") setFacultyId("");
          }}
          options={[
            { value: "GENERAL", label: "General" },
            { value: "FACULTY", label: "Faculty" },
          ]}
        />
        {scope === "FACULTY" && (
          <SelectField
            id={`calc-faculty-${calculator?.id ?? "new"}`}
            label="Faculty"
            value={facultyId}
            onChange={(e) => setFacultyId(e.target.value)}
            placeholder="Choose a faculty"
            options={faculties.map((f) => ({ value: f.id, label: f.name }))}
          />
        )}
      </div>

      <SelectField
        id={`calc-resolution-${calculator?.id ?? "new"}`}
        label="Resolution method (applies to this institution)"
        value={resolutionMethod}
        onChange={(e) => void onResolutionMethodChange(e.target.value as ApsResolutionMethod)}
        options={(Object.keys(RESOLUTION_METHOD_LABELS) as ApsResolutionMethod[]).map((m) => ({
          value: m,
          label: RESOLUTION_METHOD_LABELS[m],
        }))}
      />

      {weights.length > 0 && calculationType === "WEIGHTED" && (
        <p className="text-xs text-muted-foreground">
          Weighted subjects: {weights.filter((w) => w.subject_id).map((w) => subjectName(w.subject_id)).join(", ") || "none"}
        </p>
      )}

      <FormMessage>{error}</FormMessage>

      <div className="flex flex-wrap gap-3">
        <ActionButton type="submit" disabled={busy}>
          {busy ? "Saving…" : (submitLabel ?? (calculator ? "Save changes" : "Add calculator"))}
        </ActionButton>
        {onCancel && (
          <ActionButton type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </ActionButton>
        )}
      </div>
    </form>
  );
}

function SubjectPicker({
  label,
  subjects,
  selected,
  onChange,
}: {
  label: string;
  subjects: Subject[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subjects captured yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => {
            const active = selected.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={
                  active
                    ? "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                    : "rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                }
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

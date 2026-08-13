import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ProspectusDocument } from "@/lib/prospectus";
import {
  bandsFromProposal,
  confirmApsRule,
  createUnverifiedApsRule,
  fetchApsRuleSummary,
  unlinkApsRule,
  type ApsRuleSummary,
  type RuleBandInput,
} from "@/lib/prospectus-publish";
import { TextField } from "@/components/TextField";

/**
 * Human review of the APS calculation the AI believes a prospectus describes.
 * A proposed rule is only ever created as UNVERIFIED and inactive; it becomes
 * usable by the eligibility engine when an administrator explicitly confirms it.
 */
export function ApsRuleReviewCard({
  doc,
  onRuleLinked,
}: {
  doc: ProspectusDocument;
  onRuleLinked: (ruleId: string | null) => void;
}) {
  const proposal = doc.extraction_payload?.proposed_aps ?? null;
  const [rule, setRule] = useState<ApsRuleSummary | null>(null);
  const [name, setName] = useState(proposal?.name ?? `${doc.title} APS calculation`);
  const [version, setVersion] = useState(doc.academic_year ?? "v1");
  const [counting, setCounting] = useState(
    proposal?.counting_subject_count != null ? String(proposal.counting_subject_count) : "",
  );
  const [bands, setBands] = useState<RuleBandInput[]>(() => {
    const fromAi = bandsFromProposal(doc);
    return fromAi.length > 0 ? fromAi : [{ min: "", max: "", points: "", label: "" }];
  });
  const [linkUniversity, setLinkUniversity] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const verified = rule?.status === "verified";

  // Re-seed the editable proposal whenever a fresh extraction lands, so the
  // form shows AI data immediately instead of only after a page reload.
  useEffect(() => {
    if (doc.aps_rule_id) return;
    setName(proposal?.name ?? `${doc.title} APS calculation`);
    setVersion(doc.academic_year ?? "v1");
    setCounting(
      proposal?.counting_subject_count != null ? String(proposal.counting_subject_count) : "",
    );
    const fromAi = bandsFromProposal(doc);
    setBands(fromAi.length > 0 ? fromAi : [{ min: "", max: "", points: "", label: "" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.extracted_at, doc.aps_rule_id]);

  useEffect(() => {
    let active = true;
    if (!doc.aps_rule_id) {
      setRule(null);
      return;
    }
    fetchApsRuleSummary(doc.aps_rule_id)
      .then((r) => {
        if (active) setRule(r);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [doc.aps_rule_id]);

  function setBand(index: number, key: keyof RuleBandInput, value: string) {
    setBands((prev) => prev.map((b, i) => (i === index ? { ...b, [key]: value } : b)));
  }

  async function create() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await createUnverifiedApsRule({
        prospectusId: doc.id,
        name: name.trim() || `${doc.title} APS calculation`,
        version,
        description: doc.aps_methodology_text,
        countingSubjectCount: counting.trim() ? Number(counting) : null,
        bands: bands.filter((b) => b.min || b.max || b.points),
      });
      setRule(created);
      onRuleLinked(created.id);
      setMessage("Saved as an UNVERIFIED rule. It stays unused until you confirm it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That rule couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!rule) return;
    setBusy(true);
    setError("");
    try {
      await confirmApsRule(rule.id, linkUniversity ? doc.university_id : null);
      setRule({ ...rule, status: "verified", is_active: true });
      setMessage(
        linkUniversity && doc.university_id
          ? "Confirmed. This university now calculates APS with this rule."
          : "Confirmed. The rule is live and can be assigned to universities.",
      );
    } catch {
      setError("That rule couldn't be confirmed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (!rule) return;
    setBusy(true);
    try {
      await unlinkApsRule(doc.id, rule.id);
      setRule(null);
      onRuleLinked(null);
      setMessage("Proposed rule discarded.");
    } catch {
      setError("That rule couldn't be discarded — it may already be in use.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={
        verified
          ? "mt-6 rounded-[2rem] border border-border bg-card p-6 md:p-8"
          : "mt-6 rounded-[2rem] border border-warning/50 bg-warning/5 p-6 md:p-8"
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-semibold">APS calculation review</h2>
        <span
          className={
            verified
              ? "rounded-full border border-success/40 bg-success/10 px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-success"
              : "rounded-full border border-warning/50 bg-warning/10 px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warning"
          }
        >
          {verified ? "Verified" : rule ? `${rule.status} — needs confirmation` : "Not confirmed"}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand APS calculation review" : "Collapse APS calculation review"}
          className="ml-auto rounded-full border border-border p-2 hover:bg-secondary"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
      {collapsed ? null : (
        <>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Anything the AI reads about APS is a proposal. It is stored as an unverified rule and is
        never used to score a student until an administrator confirms it.
      </p>

      <div className="mt-5">
        <h3 className="text-sm font-semibold">Methodology found in the document</h3>
        <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
          {doc.aps_methodology_text ?? "No APS methodology was found in this document."}
        </p>
      </div>

      {proposal?.notes?.length ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Unclear or ambiguous</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {proposal.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}
      {message && !error && <p className="mt-4 text-sm font-medium text-success">{message}</p>}

      {rule ? (
        <div className="mt-6 rounded-2xl border border-border bg-background p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">{rule.name}</h3>
            <span
              className={
                rule.status === "verified"
                  ? "rounded-full border border-success/40 bg-success/10 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-widest text-foreground"
                  : "rounded-full border border-border px-3 py-1 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
              }
            >
              {rule.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {rule.code} · version {rule.version}
            {rule.counting_subject_count ? ` · counts ${rule.counting_subject_count} subjects` : ""}
          </p>
          {rule.status === "verified" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Confirmed and available to the eligibility engine.
            </p>
          ) : (
            <>
              {doc.university_id && (
                <label className="mt-4 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={linkUniversity}
                    onChange={(e) => setLinkUniversity(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Also set this as the APS rule for {doc.universities?.name ?? "this university"}
                </label>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirm}
                  className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
                >
                  Confirm calculation as verified
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={discard}
                  className="rounded-full border border-destructive/40 px-5 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60"
                >
                  Discard proposal
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Proposed calculation — edit before saving</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <TextField
              id="aps-rule-name"
              label="Rule name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              id="aps-rule-version"
              label="Version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
            <TextField
              id="aps-rule-counting"
              label="Subjects counted"
              inputMode="numeric"
              value={counting}
              onChange={(e) => setCounting(e.target.value)}
            />
          </div>

          <div className="mt-5 space-y-3">
            {bands.map((band, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[repeat(4,1fr)_auto] md:items-end">
                <TextField
                  id={`band-min-${index}`}
                  label="From %"
                  inputMode="numeric"
                  value={band.min}
                  onChange={(e) => setBand(index, "min", e.target.value)}
                />
                <TextField
                  id={`band-max-${index}`}
                  label="To %"
                  inputMode="numeric"
                  value={band.max}
                  onChange={(e) => setBand(index, "max", e.target.value)}
                />
                <TextField
                  id={`band-points-${index}`}
                  label="APS points"
                  inputMode="numeric"
                  value={band.points}
                  onChange={(e) => setBand(index, "points", e.target.value)}
                />
                <TextField
                  id={`band-label-${index}`}
                  label="Label"
                  value={band.label}
                  onChange={(e) => setBand(index, "label", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setBands((prev) => prev.filter((_, i) => i !== index))}
                  className="h-[46px] rounded-full border border-border px-4 text-sm font-semibold hover:bg-secondary"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setBands((prev) => [...prev, { min: "", max: "", points: "", label: "" }])}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              Add band
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={create}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
            >
              Save as unverified rule
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

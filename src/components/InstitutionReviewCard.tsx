import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { fetchProvinces } from "@/lib/profile";
import { fetchAdminUniversities, type AdminUniversity } from "@/lib/admin";
import {
  createInstitution,
  fetchInstitution,
  linkProspectusInstitution,
  updateInstitution,
  type Institution,
} from "@/lib/institutions";
import { proposedInstitution, type ProspectusDocument } from "@/lib/prospectus";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { PublicationPill, ActivePill } from "@/components/StatusPill";

type Province = { id: string; name: string; code: string };

type Props = {
  doc: ProspectusDocument;
  onInstitutionLinked: (institution: Institution, stagedUpdated: number) => void;
};

const EMPTY = {
  name: "",
  short_name: "",
  city: "",
  province_id: "",
  website_url: "",
  application_url: "",
  description: "",
};

/**
 * Step 1 of the review workflow: confirm WHICH institution this document
 * belongs to before any course is reviewed. Linking here back-fills every
 * staged course, so course-level review never has to fix a missing
 * university link.
 */
export function InstitutionReviewCard({ doc, onInstitutionLinked }: Props) {
  const proposal = proposedInstitution(doc);
  const detectedName = proposal?.name ?? doc.extraction_payload?.university_name ?? doc.title ?? "";

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [universities, setUniversities] = useState<AdminUniversity[]>([]);
  const [linked, setLinked] = useState<Institution | null>(null);
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [existingId, setExistingId] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchProvinces(),
      fetchAdminUniversities(),
      doc.university_id ? fetchInstitution(doc.university_id) : Promise.resolve(null),
    ])
      .then(([p, u, inst]) => {
        if (!active) return;
        setProvinces(p as Province[]);
        setUniversities(u);
        setLinked(inst);
        if (inst) {
          setForm({
            name: inst.name,
            short_name: inst.short_name ?? "",
            city: inst.city ?? "",
            province_id: inst.province_id,
            website_url: inst.website_url ?? "",
            application_url: inst.application_url ?? "",
            description: inst.description ?? "",
          });
        } else {
          const guessed = p.find(
            (province) =>
              proposal?.province &&
              province.name.toLowerCase().includes(proposal.province.toLowerCase().replace(/province/i, "").trim()),
          );
          setForm({
            name: detectedName,
            short_name: proposal?.short_name ?? "",
            city: proposal?.city ?? "",
            province_id: guessed?.id ?? "",
            website_url: proposal?.website_url ?? "",
            application_url: proposal?.application_url ?? "",
            description: proposal?.institution_type ? `Institution type: ${proposal.institution_type}` : "",
          });
        }
      })
      .catch(() => {
        if (active) setError("We couldn't load the institution list. Please refresh the page.");
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.university_id, doc.extracted_at, detectedName]);

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: p.id, label: p.name })),
    [provinces],
  );

  function set(key: keyof typeof EMPTY, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!form.name.trim()) return setError("Give the institution a name before registering it.");
    if (!form.province_id) return setError("Choose the province this institution is in.");
    setBusy(true);
    try {
      const created = await createInstitution({
        name: form.name,
        short_name: form.short_name || null,
        code: null,
        city: form.city || null,
        province_id: form.province_id,
        description: form.description || null,
        website_url: form.website_url || null,
        application_url: form.application_url || null,
      });
      const updated = await linkProspectusInstitution(doc.id, created.id);
      setLinked(created);
      setUniversities((prev) => [...prev, { ...(created as unknown as AdminUniversity), provinces: null }]);
      setMessage(
        `${created.name} registered as a draft institution and linked to this prospectus` +
          (updated > 0 ? `, plus ${updated} staged course${updated === 1 ? "" : "s"}.` : "."),
      );
      onInstitutionLinked(created, updated);
    } catch {
      setError("That institution couldn't be registered. Please check the details and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLinkExisting(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!existingId) return setError("Choose an institution to link.");
    setBusy(true);
    try {
      const updated = await linkProspectusInstitution(doc.id, existingId);
      const inst = await fetchInstitution(existingId);
      if (inst) {
        setLinked(inst);
        setForm({
          name: inst.name,
          short_name: inst.short_name ?? "",
          city: inst.city ?? "",
          province_id: inst.province_id,
          website_url: inst.website_url ?? "",
          application_url: inst.application_url ?? "",
          description: inst.description ?? "",
        });
        setMessage(
          `Linked to ${inst.name}` +
            (updated > 0 ? `, and ${updated} staged course${updated === 1 ? "" : "s"} updated.` : "."),
        );
        onInstitutionLinked(inst, updated);
      }
    } catch {
      setError("We couldn't link that institution. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!linked) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await updateInstitution(linked.id, {
        name: form.name.trim(),
        short_name: form.short_name || null,
        city: form.city || null,
        province_id: form.province_id,
        website_url: form.website_url || null,
        application_url: form.application_url || null,
        description: form.description || null,
      });
      setLinked({ ...linked, ...form, short_name: form.short_name || null, city: form.city || null });
      setMessage("Institution details saved.");
    } catch {
      setError("Those institution details couldn't be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublication() {
    if (!linked) return;
    const next = linked.publication_status === "published" ? "draft" : "published";
    setBusy(true);
    try {
      await updateInstitution(linked.id, { publication_status: next });
      setLinked({ ...linked, publication_status: next });
      setMessage(
        next === "published"
          ? "Institution published — students can now see its published courses."
          : "Institution moved back to draft.",
      );
    } catch {
      setError("That change couldn't be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const fields = (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <TextField
        id="inst-name"
        label="Institution name"
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        placeholder="Full registered name"
      />
      <TextField
        id="inst-short"
        label="Short name / abbreviation"
        value={form.short_name}
        onChange={(e) => set("short_name", e.target.value)}
        placeholder="Optional"
      />
      <TextField
        id="inst-city"
        label="City"
        value={form.city}
        onChange={(e) => set("city", e.target.value)}
        placeholder="Optional"
      />
      <SelectField
        id="inst-province"
        label="Province"
        options={provinceOptions}
        placeholder="Choose a province"
        value={form.province_id}
        onChange={(e) => set("province_id", e.target.value)}
      />
      <TextField
        id="inst-website"
        label="Website"
        value={form.website_url}
        onChange={(e) => set("website_url", e.target.value)}
        placeholder="https://"
      />
      <TextField
        id="inst-apply"
        label="Application URL"
        value={form.application_url}
        onChange={(e) => set("application_url", e.target.value)}
        placeholder="https://"
      />
      <div className="md:col-span-2">
        <SelectField
          id="inst-desc"
          label="Institution type"
          placeholder="Choose an institution type"
          options={[
            { value: "Public University", label: "Public University" },
            { value: "TVET College", label: "TVET College" },
            { value: "Private College", label: "Private College" },
            { value: "Distance Learning Institution", label: "Distance Learning Institution" },
            { value: "Other", label: "Other" },
          ]}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div className="mt-10 rounded-[2rem] border border-border bg-card p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-semibold">Step 1 · Institution</h2>
          {linked && (
            <span className="flex gap-2">
              <PublicationPill status={linked.publication_status} />
              <ActivePill active={linked.is_active} />
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border hover:bg-secondary"
          aria-label={collapsed ? "Expand institution section" : "Collapse institution section"}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Confirm which institution this prospectus belongs to before reviewing any course. Linking
        here fills in the university for every staged course from this document.
      </p>

      {!collapsed && (
        <>
          {error && (
            <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </p>
          )}
          {message && !error && (
            <p className="mt-4 rounded-2xl border border-success/30 bg-success/5 p-4 text-sm text-success">
              {message}
            </p>
          )}

          {!linked && detectedName && (
            <p className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              Detected in the document: <span className="font-semibold text-foreground">{detectedName}</span>
              {proposal?.institution_type ? ` · ${proposal.institution_type}` : ""}
              {proposal?.city ? ` · ${proposal.city}` : ""}
              {proposal?.province ? ` · ${proposal.province}` : ""}
            </p>
          )}
          {!linked && proposal?.notes?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {proposal.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}

          {linked ? (
            <form onSubmit={handleSave}>
              {fields}
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
                >
                  Save institution details
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={togglePublication}
                  className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
                >
                  {linked.publication_status === "published" ? "Move back to draft" : "Publish institution"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="mt-5 flex gap-2">
                {(["create", "existing"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={
                      mode === m
                        ? "rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
                        : "rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
                    }
                  >
                    {m === "create" ? "Register new institution" : "Link an existing one"}
                  </button>
                ))}
              </div>

              {mode === "create" ? (
                <form onSubmit={handleCreate}>
                  {fields}
                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
                  >
                    Register institution & link
                  </button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    New institutions are created as drafts, so students only see them once you publish
                    them.
                  </p>
                </form>
              ) : (
                <form onSubmit={handleLinkExisting} className="mt-5 flex flex-wrap items-end gap-3">
                  <div className="min-w-[18rem] flex-1">
                    <SelectField
                      id="inst-existing"
                      label="Existing institution"
                      placeholder="Choose an institution"
                      options={universities.map((u) => ({
                        value: u.id,
                        label: `${u.name}${u.publication_status === "draft" ? " (draft)" : ""}`,
                      }))}
                      value={existingId}
                      onChange={(e) => setExistingId(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !existingId}
                    className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
                  >
                    Link institution
                  </button>
                </form>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

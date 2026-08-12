import { useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { TextField } from "@/components/TextField";
import { FormMessage } from "@/components/FormMessage";
import { saveMyTolerances, type StudentProfile } from "@/lib/profile";
import { toleranceSettings } from "@/lib/tolerance";

export function ToleranceSettingsCard({
  userId,
  profile,
  onSaved,
}: {
  userId: string;
  profile: StudentProfile | null;
  onSaved?: (values: { apsTolerance: number; subjectPercentageTolerance: number }) => void;
}) {
  const initial = toleranceSettings(profile);
  const [aps, setAps] = useState(String(initial.apsTolerance));
  const [subject, setSubject] = useState(String(initial.subjectPercentageTolerance));
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const apsValue = Number(aps);
    const subjectValue = Number(subject);
    if (!Number.isFinite(apsValue) || apsValue < 0 || apsValue > 20) {
      setError("APS tolerance must be a number between 0 and 20.");
      return;
    }
    if (!Number.isFinite(subjectValue) || subjectValue < 0 || subjectValue > 20) {
      setError("Subject percentage tolerance must be a number between 0 and 20.");
      return;
    }
    setError(null);
    setStatus("saving");
    try {
      await saveMyTolerances({
        userId,
        apsTolerance: apsValue,
        subjectPercentageTolerance: subjectValue,
      });
      setStatus("saved");
      onSaved?.({ apsTolerance: apsValue, subjectPercentageTolerance: subjectValue });
    } catch {
      setStatus("idle");
      setError("We couldn't save your settings. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded-[2rem] border border-border bg-card p-8">
      <span className="font-mono text-xs font-bold uppercase text-muted-foreground">
        Almost qualify settings
      </span>
      <p className="mt-4 text-sm text-muted-foreground">
        How close to a requirement you want to be before a course is flagged as{" "}
        <strong>Almost qualify</strong>. These settings never turn a requirement you don't meet into
        one you do.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <TextField
          label="APS tolerance"
          name="apsTolerance"
          type="number"
          min={0}
          max={20}
          value={aps}
          onChange={(event) => {
            setAps(event.target.value);
            setStatus("idle");
          }}
          hint="APS points"
        />
        <TextField
          label="Subject % tolerance"
          name="subjectTolerance"
          type="number"
          min={0}
          max={20}
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            setStatus("idle");
          }}
          hint="Percentage points"
        />
      </div>
      {error && (
        <div className="mt-4">
          <FormMessage variant="error">{error}</FormMessage>
        </div>
      )}
      {status === "saved" && !error && (
        <div className="mt-4">
          <FormMessage variant="success">Settings saved.</FormMessage>
        </div>
      )}
      <ActionButton type="submit" variant="outline" className="mt-6" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save settings"}
      </ActionButton>
    </form>
  );
}

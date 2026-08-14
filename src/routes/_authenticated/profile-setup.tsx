import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { TextField } from "@/components/TextField";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import { useAuth } from "@/lib/auth";
import { fetchMyProfile, saveMyProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/profile-setup")({
  head: () => ({
    meta: [
      { title: "Set up your profile — EduStarter" },
      { name: "description", content: "Tell EduStarter your name and province to finish setting up your student profile." },
      { property: "og:title", content: "Set up your profile — EduStarter" },
      { property: "og:description", content: "Finish setting up your EduStarter student profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfileSetupPage,
});

function ProfileSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const profile = await fetchMyProfile(user.id);
        if (!active) return;
        if (profile) {
          setFirstName(profile.first_name ?? "");
          setLastName(profile.last_name ?? "");
        }
      } catch {
        if (active) setFormError("We couldn't load your profile right now. Please refresh the page.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  function validate() {
    const next: Record<string, string> = {};
    if (firstName.trim().length < 2) next["firstName"] = "Please enter your first name.";
    if (lastName.trim().length < 2) next["lastName"] = "Please enter your last name.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!user || !validate()) return;
    setSaving(true);
    try {
      await saveMyProfile({ userId: user.id, firstName, lastName });
      navigate({ to: "/dashboard" });
    } catch {
      setFormError("We couldn't save your profile. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-xl px-6 py-14 md:py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Step 1 of 2</p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight">
          Let's set up your <span className="italic text-primary">profile</span>.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Just two quick details. You'll add your NSC subjects and marks in the next step, once that's ready.
        </p>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full w-1/2 rounded-full bg-primary" />
        </div>

        <div className="mt-8 rounded-[2rem] border border-border bg-card p-6 md:p-8">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading your details…</p>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <FormMessage>{formError}</FormMessage>

              <div>
                <TextField
                  id="firstName"
                  label="First name"
                  required
                  autoComplete="given-name"
                  placeholder="Thandi"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                {errors["firstName"] ? (
                  <p className="mt-1.5 text-sm text-destructive">{errors["firstName"]}</p>
                ) : null}
              </div>

              <div>
                <TextField
                  id="lastName"
                  label="Last name"
                  required
                  autoComplete="family-name"
                  placeholder="Nkosi"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                {errors["lastName"] ? (
                  <p className="mt-1.5 text-sm text-destructive">{errors["lastName"]}</p>
                ) : null}
              </div>

              <ActionButton type="submit" size="block" disabled={saving}>
                {saving ? "Saving…" : "Save and continue"}
              </ActionButton>
              <p className="text-center text-xs text-muted-foreground">
                Both fields are required. Only you can see your profile.
              </p>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

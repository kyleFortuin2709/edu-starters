import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { AuthFormShell } from "@/components/AuthFormShell";
import { TextField } from "@/components/TextField";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import { friendlyAuthError } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — EduStarter" },
      { name: "description", content: "Set a new password for your EduStarter student account." },
      { property: "og:title", content: "Choose a new password — EduStarter" },
      { property: "og:description", content: "Set a new password for your EduStarter student account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecoveryLink = window.location.hash.includes("type=recovery");
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (isRecoveryLink && session)) setHasRecovery(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasRecovery(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Please choose a password with at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match. Please type them again.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(friendlyAuthError(updateError.message));
      return;
    }
    navigate({ to: "/profile" });
  }

  return (
    <SiteLayout>
      <AuthFormShell
        eyebrow="New password"
        title={
          <>
            Choose a new <span className="italic text-primary">password</span>.
          </>
        }
        subtitle="Pick something you'll remember — at least 6 characters."
        footer={
          <>
            Changed your mind?{" "}
            <Link to="/login" className="font-bold text-primary underline underline-offset-4">
              Back to log in
            </Link>
          </>
        }
      >
        {!ready ? (
          <p className="text-sm text-muted-foreground">Checking your reset link…</p>
        ) : !hasRecovery ? (
          <FormMessage>
            This reset link has expired or was already used. Please request a new one from the forgot password
            page.
          </FormMessage>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <FormMessage>{error}</FormMessage>
            <TextField
              id="password"
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              id="confirm"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Type it again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <ActionButton type="submit" size="block" disabled={busy}>
              {busy ? "Saving…" : "Save new password"}
            </ActionButton>
          </form>
        )}
      </AuthFormShell>
    </SiteLayout>
  );
}

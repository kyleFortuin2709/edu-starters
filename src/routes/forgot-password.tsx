import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { AuthFormShell } from "@/components/AuthFormShell";
import { TextField } from "@/components/TextField";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import { friendlyAuthError } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — EduStarter" },
      { name: "description", content: "Forgot your EduStarter password? Send yourself a secure reset link." },
      { property: "og:title", content: "Reset your password — EduStarter" },
      { property: "og:description", content: "Send yourself a secure EduStarter password reset link." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter the email you signed up with.");
      return;
    }
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) {
      setError(friendlyAuthError(resetError.message));
      return;
    }
    setSent(true);
  }

  return (
    <SiteLayout>
      <AuthFormShell
        eyebrow="Password help"
        title={
          <>
            Let's get you back <span className="italic text-primary">in</span>.
          </>
        }
        subtitle="Enter your email and we'll send you a link to choose a new password."
        footer={
          <>
            Remembered it?{" "}
            <Link to="/login" className="font-bold text-primary underline underline-offset-4">
              Back to log in
            </Link>
          </>
        }
      >
        {sent ? (
          <FormMessage tone="success">
            If an account exists for {email}, a reset link is on its way. Check your inbox and spam folder.
          </FormMessage>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <FormMessage>{error}</FormMessage>
            <TextField
              id="email"
              label="Email address"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <ActionButton type="submit" size="block" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </ActionButton>
          </form>
        )}
      </AuthFormShell>
    </SiteLayout>
  );
}

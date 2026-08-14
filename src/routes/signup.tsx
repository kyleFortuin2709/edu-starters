import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { AuthFormShell } from "@/components/AuthFormShell";
import { TextField } from "@/components/TextField";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import { friendlyAuthError } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your free EduStarter account" },
      { name: "description", content: "Sign up free to build your EduStarter student profile." },
      { property: "og:title", content: "Create your free EduStarter account" },
      { property: "og:description", content: "Sign up free to build your EduStarter student profile." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (password.length < 6) {
      setError("Please choose a password with at least 6 characters.");
      return;
    }
    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(false);
    if (signUpError) {
      setError(friendlyAuthError(signUpError.message));
      return;
    }
    if (!data.session) {
      setCheckEmail(true);
      return;
    }
    navigate({ to: "/profile-setup" });
  }

  return (
    <SiteLayout>
      <AuthFormShell
        eyebrow="Join for free"
        title={
          <>
            Start your <span className="italic text-primary">application</span> journey.
          </>
        }
        subtitle="Create an account, then set up your student profile in under a minute."
        footer={
          <>
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-primary underline underline-offset-4">
              Log in
            </Link>
          </>
        }
      >
        {checkEmail ? (
          <div className="space-y-4">
            <FormMessage tone="success">
              Almost there! We've sent a confirmation link to {email}. Click it to activate your account, then
              log in to set up your profile.
            </FormMessage>
            <Link to="/login" className="block text-center text-sm font-bold text-primary underline underline-offset-4">
              Go to log in
            </Link>
          </div>
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
            <TextField
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="-mt-3 text-xs text-muted-foreground">
              Use something unique — common passwords found in past data breaches are blocked.
            </p>
            <ActionButton type="submit" size="block" disabled={busy}>
              {busy ? "Creating your account…" : "Create my account"}
            </ActionButton>
          </form>
        )}
      </AuthFormShell>
    </SiteLayout>
  );
}

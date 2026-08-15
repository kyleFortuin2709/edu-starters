import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { AuthFormShell } from "@/components/AuthFormShell";
import { TextField } from "@/components/TextField";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import { friendlyAuthError } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — EduStarter" },
      { name: "description", content: "Log in to EduStarter to manage your student profile and NSC results." },
      { property: "og:title", content: "Log in — EduStarter" },
      { property: "og:description", content: "Log in to EduStarter to manage your student profile." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(friendlyAuthError(signInError.message));
      return;
    }
    navigate({ to: "/profile" });
  }

  return (
    <SiteLayout>
      <AuthFormShell
        eyebrow="Welcome back"
        title={
          <>
            Pick up where you <span className="italic text-primary">left off</span>.
          </>
        }
        subtitle="Log in to view your profile and, soon, your course matches."
        footer={
          <>
            New here?{" "}
            <Link to="/signup" className="font-bold text-primary underline underline-offset-4">
              Create a free account
            </Link>
          </>
        }
      >
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
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm font-semibold text-primary underline underline-offset-4">
              Forgot your password?
            </Link>
          </div>
          <ActionButton type="submit" size="block" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </ActionButton>
        </form>
      </AuthFormShell>
    </SiteLayout>
  );
}

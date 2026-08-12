import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { AuthFormShell } from "@/components/AuthFormShell";
import { TextField } from "@/components/TextField";
import { ActionButton } from "@/components/ActionButton";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — EduStarter" },
      {
        name: "description",
        content: "Log in to EduStarter to see which South African university courses match your NSC results.",
      },
      { property: "og:title", content: "Log in — EduStarter" },
      {
        property: "og:description",
        content: "Log in to EduStarter to see which South African university courses match your NSC results.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    signIn({ name: email.split("@")[0] || "Student", email });
    navigate({ to: "/dashboard" });
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
        subtitle="Log in to view your saved results and course matches."
        footer={
          <>
            New here?{" "}
            <Link to="/signup" className="font-bold text-primary underline underline-offset-4">
              Create a free account
            </Link>
          </>
        }
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <TextField
            id="email"
            label="Email address"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField id="password" label="Password" type="password" required placeholder="••••••••" />
          <ActionButton type="submit" size="block">
            Log in
          </ActionButton>
          <p className="text-center text-xs text-muted-foreground">
            Sign-in is a placeholder for now — no account is created yet.
          </p>
        </form>
      </AuthFormShell>
    </SiteLayout>
  );
}
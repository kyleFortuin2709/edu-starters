import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { AuthFormShell } from "@/components/AuthFormShell";
import { TextField } from "@/components/TextField";
import { ActionButton } from "@/components/ActionButton";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your free EduStarter account" },
      {
        name: "description",
        content: "Sign up free to match your NSC marks with South African university degrees and diplomas.",
      },
      { property: "og:title", content: "Create your free EduStarter account" },
      {
        property: "og:description",
        content: "Sign up free to match your NSC marks with South African university degrees and diplomas.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    signIn({ name: name || "Student", email });
    navigate({ to: "/dashboard" });
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
        subtitle="Create a profile to save your marks and track every course you match."
        footer={
          <>
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-primary underline underline-offset-4">
              Log in
            </Link>
          </>
        }
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <TextField
            id="name"
            label="Full name"
            required
            placeholder="Thandi Nkosi"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
            Create my account
          </ActionButton>
          <p className="text-center text-xs text-muted-foreground">
            Sign-up is a placeholder for now — no account is created yet.
          </p>
        </form>
      </AuthFormShell>
    </SiteLayout>
  );
}
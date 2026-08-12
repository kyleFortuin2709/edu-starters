import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthFormShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-md px-6 py-16 md:py-24">
      <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
      <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">{title}</h1>
      <p className="mt-4 text-muted-foreground">{subtitle}</p>

      <div className="mt-10 rounded-[2rem] border border-border bg-card p-8">{children}</div>

      <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link to="/" className="underline underline-offset-4 hover:text-foreground">
          Back to home
        </Link>
      </p>
    </section>
  );
}
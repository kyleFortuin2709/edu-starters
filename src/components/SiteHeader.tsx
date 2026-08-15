import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/use-admin";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "How it works", to: "/#how-it-works" },
  { label: "Why EduStarter", to: "/#features" },
  { label: "Get started", to: "/#cta" },
];

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [open, setOpen] = useState(false);
  const marketingLinks = user ? [] : navLinks;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Logo />

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {marketingLinks.map((link) => (
            <a key={link.label} href={link.to} className="transition-colors hover:text-primary">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm font-semibold hover:text-primary">
                Dashboard
              </Link>
              <Link to="/profile" className="text-sm font-semibold hover:text-primary">
                My profile
              </Link>
              {isAdmin && (
                <Link to="/admin" className="text-sm font-semibold hover:text-primary">
                  Admin
                </Link>
              )}
              <button
                onClick={signOut}
                className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-primary"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold hover:text-primary">
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-primary"
              >
                Join for free
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      <div className={cn("border-t border-border px-6 py-4 md:hidden", open ? "block" : "hidden")}>
        <nav className="flex flex-col gap-4 text-sm font-medium text-muted-foreground">
          {marketingLinks.map((link) => (
            <a key={link.label} href={link.to} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setOpen(false)} className="font-semibold text-foreground">
                  Dashboard
                </Link>
                <Link to="/profile" onClick={() => setOpen(false)} className="font-semibold text-foreground">
                  My profile
                </Link>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setOpen(false)} className="font-semibold text-foreground">
                    Admin
                  </Link>
                )}
                <button onClick={signOut} className="text-left font-semibold text-foreground">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="font-semibold text-foreground">
                  Log in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-foreground px-4 py-2 text-center font-semibold text-background"
                >
                  Join for free
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
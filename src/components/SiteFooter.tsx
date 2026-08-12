import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-7xl flex-col items-center gap-6 border-t border-border px-6 py-12 md:flex-row md:justify-between">
      <Logo compact />
      <p className="text-center text-sm text-muted-foreground">
        Built for the future of South African students. &copy; {new Date().getFullYear()}
      </p>
      <div className="flex gap-6 text-sm font-medium">
        <a href="/#privacy" className="text-muted-foreground transition-colors hover:text-foreground">
          Privacy
        </a>
        <a href="/#terms" className="text-muted-foreground transition-colors hover:text-foreground">
          Terms
        </a>
      </div>
    </footer>
  );
}
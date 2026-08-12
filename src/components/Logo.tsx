import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)} aria-label="EduStarter home">
      <span
        className={cn(
          "grid place-items-center rounded-lg bg-primary font-display font-black text-primary-foreground",
          compact ? "size-6 text-[10px]" : "size-8 text-sm",
        )}
        aria-hidden="true"
      >
        E
      </span>
      <span className={cn("font-display font-bold tracking-tight", compact ? "text-base" : "text-xl")}>
        EduStarter
      </span>
    </Link>
  );
}
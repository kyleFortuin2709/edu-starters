import { cn } from "@/lib/utils";

type Tone = "published" | "draft" | "active" | "inactive" | "demo";

const TONE_CLASSES: Record<Tone, string> = {
  published: "border-success/40 bg-success/10 text-success",
  draft: "border-warning/40 bg-warning/10 text-warning",
  active: "border-primary/40 bg-primary/10 text-primary",
  inactive: "border-border bg-muted text-muted-foreground",
  demo: "border-border bg-muted text-muted-foreground",
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-wide",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PublicationPill({ status }: { status: "draft" | "published" }) {
  return (
    <StatusPill tone={status === "published" ? "published" : "draft"}>
      {status === "published" ? "Live" : "Draft"}
    </StatusPill>
  );
}

export function ActivePill({ active }: { active: boolean }) {
  return <StatusPill tone={active ? "active" : "inactive"}>{active ? "Active" : "Inactive"}</StatusPill>;
}

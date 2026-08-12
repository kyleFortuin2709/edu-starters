import { cn } from "@/lib/utils";

export type QualificationStatus = "qualify" | "almost" | "no";

const config: Record<QualificationStatus, { label: string; dot: string; text: string }> = {
  qualify: { label: "You Qualify", dot: "bg-success", text: "text-success" },
  almost: { label: "Almost Qualify", dot: "bg-warning", text: "text-warning" },
  no: { label: "Don't Qualify", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

export function QualificationBadge({
  status,
  className,
}: {
  status: QualificationStatus;
  className?: string;
}) {
  const { label, dot, text } = config[status];
  return (
    <span
      className={cn("flex items-center gap-1.5 font-mono text-xs font-bold uppercase", text, className)}
    >
      <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" />
      {label}
    </span>
  );
}
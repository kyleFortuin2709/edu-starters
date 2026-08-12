import { cn } from "@/lib/utils";
import type { EligibilityStatus } from "@/lib/eligibility";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/eligibility-format";

export function EligibilityStatusBadge({
  status,
  className,
}: {
  status: EligibilityStatus;
  className?: string;
}) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 font-mono text-xs font-bold uppercase",
        tone.text,
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", tone.dot)} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
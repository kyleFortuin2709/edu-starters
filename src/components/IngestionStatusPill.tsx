import { StatusPill } from "@/components/StatusPill";
import { ingestionStatusLabel, type IngestionStatus } from "@/lib/prospectus";

const TONE: Record<IngestionStatus, "published" | "draft" | "active" | "inactive" | "demo"> = {
  uploaded: "inactive",
  processing: "active",
  review_required: "draft",
  approved: "active",
  published: "published",
};

export function IngestionStatusPill({ status }: { status: IngestionStatus }) {
  return <StatusPill tone={TONE[status]}>{ingestionStatusLabel(status)}</StatusPill>;
}

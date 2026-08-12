import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSavedCourses } from "@/lib/saved-courses-context";

export function SaveCourseButton({
  courseId,
  className,
  showLabel = false,
}: {
  courseId: string;
  className?: string;
  showLabel?: boolean;
}) {
  const { isSaved, toggle, ready } = useSavedCourses();
  const [busy, setBusy] = useState(false);
  const saved = isSaved(courseId);

  return (
    <button
      type="button"
      disabled={!ready || busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved courses" : "Save this course"}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setBusy(true);
        try {
          await toggle(courseId);
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[0.65rem] font-bold uppercase transition-colors disabled:opacity-50",
        saved
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
      {showLabel ? (saved ? "Saved" : "Save course") : null}
    </button>
  );
}

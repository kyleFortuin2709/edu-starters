import { cn } from "@/lib/utils";
import { QualificationBadge, type QualificationStatus } from "./QualificationBadge";

export type Course = {
  institution: string;
  name: string;
  summary: string;
  aps: number;
  delta: string;
  status: QualificationStatus;
};

const border: Record<QualificationStatus, string> = {
  qualify: "border-border hover:border-success/30",
  almost: "border-dashed border-border hover:border-warning/30",
  no: "border-border opacity-80",
};

const deltaTone: Record<QualificationStatus, string> = {
  qualify: "text-success",
  almost: "text-warning",
  no: "text-muted-foreground",
};

export function CourseCard({ course, className }: { course: Course; className?: string }) {
  return (
    <article
      className={cn(
        "relative rounded-[2rem] border bg-card p-8 transition-all",
        border[course.status],
        className,
      )}
    >
      <QualificationBadge status={course.status} className="absolute right-8 top-6" />
      <p className="mb-4 font-mono text-xs uppercase text-muted-foreground">{course.institution}</p>
      <h3 className="mb-2 font-display text-2xl font-semibold">{course.name}</h3>
      <p className="mb-8 text-sm text-muted-foreground">{course.summary}</p>
      <div className="flex items-center justify-between border-t border-border pt-6">
        <span className="font-mono text-xs">APS: {course.aps}</span>
        <span className={cn("font-bold", deltaTone[course.status])}>{course.delta}</span>
      </div>
    </article>
  );
}
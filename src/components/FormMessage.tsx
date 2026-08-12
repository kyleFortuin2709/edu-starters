export function FormMessage({ tone = "error", children }: { tone?: "error" | "success"; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          : "rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-foreground"
      }
    >
      {children}
    </p>
  );
}

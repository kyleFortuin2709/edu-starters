export type Career = { title: string; description: string };

/** Reads the stored `careers` JSON column defensively. */
export function parseCareers(value: unknown): Career[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { title?: unknown; description?: unknown };
    if (typeof row.title !== "string" || typeof row.description !== "string") return [];
    return [{ title: row.title, description: row.description }];
  });
}
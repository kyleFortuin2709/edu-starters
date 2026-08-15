import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { apsMethodologyText, proposedAps, type ProspectusDocument } from "@/lib/prospectus";

/**
 * Human review of the APS calculation the AI believes a prospectus describes.
 * Calculators are set up through the institution's APS calculator manager,
 * which is rendered inside this card as `children`.
 */
export function ApsRuleReviewCard({
  doc,
  children,
}: {
  doc: ProspectusDocument;
  /** Extra review content (e.g. the institution's APS calculators). */
  children?: React.ReactNode;
}) {
  const proposal = proposedAps(doc);
  const methodology = apsMethodologyText(doc);
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="mt-6 rounded-[2rem] border border-border bg-card p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-semibold">APS calculation review</h2>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand APS calculation review" : "Collapse APS calculation review"}
          className="ml-auto rounded-full border border-border p-2 hover:bg-secondary"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
      {collapsed ? null : (
        <>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Anything the AI reads about APS is a proposal. Use the calculators below to set how this
            institution scores students.
          </p>

          <div className="mt-5">
            <h3 className="text-sm font-semibold">Methodology found in the document</h3>
            <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              {methodology ?? "No APS methodology was found in this document."}
            </p>
          </div>

          {proposal?.notes?.length ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Unclear or ambiguous</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {proposal.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {children}
        </>
      )}
    </div>
  );
}

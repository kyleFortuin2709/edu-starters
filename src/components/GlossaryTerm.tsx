import { useEffect, useId, useRef, useState } from "react";

/**
 * A highlighted word with a plain-language explanation that opens on hover
 * (desktop) or tap/click (touch and keyboard).
 */
export function GlossaryTerm({ term, definition }: { term: string; definition: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    function onDocClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [pinned]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => !pinned && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        onClick={() => {
          setPinned((p) => !p);
          setOpen((o) => (pinned ? false : true) || !o);
        }}
        className="cursor-help rounded-sm bg-primary/10 px-0.5 font-medium text-primary underline decoration-primary/40 decoration-dotted underline-offset-2 transition-colors hover:bg-primary/20"
      >
        {term}
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-lg"
        >
          <span className="block font-semibold capitalize">{term}</span>
          <span className="mt-1 block text-muted-foreground">{definition}</span>
        </span>
      ) : null}
    </span>
  );
}

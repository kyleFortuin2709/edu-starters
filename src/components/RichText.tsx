import { Fragment, type ReactNode } from "react";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { GLOSSARY_PATTERN, lookupGlossary } from "@/lib/glossary";

/** Wraps any glossary words found in a plain string with explanation tooltips. */
function withGlossary(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  const pattern = new RegExp(GLOSSARY_PATTERN.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const definition = lookupGlossary(match[0]);
    if (!definition) continue;
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(
      <GlossaryTerm key={`${keyPrefix}-g-${match.index}`} term={match[0]} definition={definition} />,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Renders **bold**, *italic* and `code` inside one line of text. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-i-${index}`;
    if (/^(\*\*|__).+(\*\*|__)$/.test(part)) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {withGlossary(part.slice(2, -2), key)}
        </strong>
      );
    }
    if (/^(\*|_).+(\*|_)$/.test(part)) {
      return (
        <em key={key} className="italic">
          {withGlossary(part.slice(1, -1), key)}
        </em>
      );
    }
    if (/^`.+`$/.test(part)) {
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{withGlossary(part, key)}</Fragment>;
  });
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "h"; text: string };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ type: "p", lines: [] });
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const previous = blocks[blocks.length - 1];
    if (heading) {
      blocks.push({ type: "h", text: heading[1] ?? "" });
    } else if (bullet) {
      if (previous?.type === "ul") previous.items.push(bullet[1] ?? "");
      else blocks.push({ type: "ul", items: [bullet[1] ?? ""] });
    } else if (numbered) {
      if (previous?.type === "ol") previous.items.push(numbered[1] ?? "");
      else blocks.push({ type: "ol", items: [numbered[1] ?? ""] });
    } else if (previous?.type === "p" && previous.lines.length) {
      previous.lines.push(line);
    } else {
      blocks.push({ type: "p", lines: [line] });
    }
  }
  return blocks.filter((b) => b.type !== "p" || b.lines.length > 0);
}

/** Lightweight markdown renderer with student-friendly glossary tooltips. */
export function RichText({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        const key = `b-${index}`;
        if (block.type === "h") {
          return (
            <p key={key} className="font-display text-base font-semibold">
              {renderInline(block.text, key)}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={key} className="ml-1 space-y-1.5">
              {block.items.map((item, i) => (
                <li key={`${key}-${i}`} className="flex gap-2">
                  <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{renderInline(item, `${key}-${i}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={key} className="ml-1 space-y-1.5">
              {block.items.map((item, i) => (
                <li key={`${key}-${i}`} className="flex gap-2">
                  <span className="font-mono text-xs text-primary">{i + 1}.</span>
                  <span>{renderInline(item, `${key}-${i}`)}</span>
                </li>
              ))}
            </ol>
          );
        }
        return <p key={key}>{renderInline(block.lines.join(" "), key)}</p>;
      })}
    </div>
  );
}

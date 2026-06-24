import type { Highlight } from "@/lib/types";

export function EvidenceText({ text, highlights }: { text: string; highlights: Highlight[] }) {
  if (!highlights.length) {
    return <span>{text}</span>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const highlight of mergeHighlights(highlights, text.length)) {
    if (highlight.start > cursor) {
      parts.push(<span key={`text-${cursor}`}>{text.slice(cursor, highlight.start)}</span>);
    }

    parts.push(
      <mark
        key={`${highlight.start}-${highlight.end}`}
        className="rounded bg-copper/20 px-0.5 text-inherit ring-1 ring-copper/25 dark:bg-copper/25 dark:ring-copper/35"
      >
        {text.slice(highlight.start, highlight.end)}
      </mark>
    );
    cursor = highlight.end;
  }

  if (cursor < text.length) {
    parts.push(<span key={`text-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return <span>{parts}</span>;
}

function mergeHighlights(highlights: Highlight[], maxLength: number) {
  const sorted = highlights
    .map((highlight) => ({
      ...highlight,
      start: Math.max(0, Math.min(highlight.start, maxLength)),
      end: Math.max(0, Math.min(highlight.end, maxLength))
    }))
    .filter((highlight) => highlight.end > highlight.start)
    .sort((a, b) => a.start - b.start);

  const merged: Highlight[] = [];
  for (const highlight of sorted) {
    const previous = merged.at(-1);
    if (previous && highlight.start <= previous.end) {
      previous.end = Math.max(previous.end, highlight.end);
      continue;
    }
    merged.push({ ...highlight });
  }
  return merged;
}

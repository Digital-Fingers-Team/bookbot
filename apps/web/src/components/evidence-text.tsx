import type { Highlight } from "@/lib/types";

const TONE_CLASS = {
  // Query-term matches (which words from the question appear here).
  query: "rounded bg-copper/20 px-0.5 text-inherit ring-1 ring-copper/25 dark:bg-copper/25 dark:ring-copper/35",
  // Text the model's answer actually drew on.
  answer: "rounded bg-moss/15 px-0.5 text-inherit ring-1 ring-moss/25 dark:bg-sea/20 dark:ring-sea/35"
} as const;

export function EvidenceText({
  text,
  highlights,
  tone = "query"
}: {
  text: string;
  highlights: Highlight[];
  tone?: keyof typeof TONE_CLASS;
}) {
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
      <mark key={`${highlight.start}-${highlight.end}`} className={TONE_CLASS[tone]}>
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

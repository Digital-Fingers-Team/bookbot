const DEFAULT_PAGE_CHARS = 3000;

/**
 * Split a long plain-text document into synthetic "pages" of roughly
 * `pageChars` characters, breaking on paragraph boundaries so words are never
 * cut mid-sentence. Used by formats with no native page concept (TXT, DOCX) so
 * the reader and RAG citations still have stable page numbers.
 */
export function paginate(text: string, pageChars: number = DEFAULT_PAGE_CHARS): string[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (!paragraphs.length) {
    return [];
  }

  const pages: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const paragraph of paragraphs) {
    if (currentLength > 0 && currentLength + paragraph.length > pageChars) {
      pages.push(current.join("\n\n"));
      current = [];
      currentLength = 0;
    }

    current.push(paragraph);
    currentLength += paragraph.length;
  }

  if (current.length) {
    pages.push(current.join("\n\n"));
  }

  return pages;
}

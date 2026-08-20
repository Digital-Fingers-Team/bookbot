import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export type ExcelBookRow = {
  rowNumber: number;
  sourceId: string;
  title: string;
  description: string;
  author: string;
  language: string;
  year: number | null;
  isbn: string;
  city: string;
  pageCount: number | null;
  keywords: string;
  viewerUrl: string;
  fileName: string;
  category?: string;
  price?: number;
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/**
 * Parse the current Arado export. It has no header row, so the column positions
 * are intentionally documented here instead of guessed from display labels.
 */
export async function parseBooksExcel(buffer: Buffer): Promise<ExcelBookRow[]> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("text");
  const sheetXml = await zip.file("xl/worksheets/sheet1.xml")?.async("text");
  if (!sheetXml) throw new Error("The workbook does not contain the first worksheet.");

  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
  const sheet = parser.parse(sheetXml) as { worksheet?: { sheetData?: { row?: Record<string, any>[] } } };
  const rows = sheet.worksheet?.sheetData?.row ?? [];
  return rows.map((row, index) => {
    const values = new Map<number, string>();
    const cells = Array.isArray(row.c) ? row.c : row.c ? [row.c] : [];
    for (const cell of cells) {
      const ref = String(cell["@_r"] ?? "");
      const col = columnNumber(ref);
      const raw = cell.v;
      if (col && raw !== undefined) {
        const value = String(raw);
        values.set(col, cell["@_t"] === "s" ? shared[Number(value)] ?? "" : value);
      }
    }
    return {
      rowNumber: index + 1,
      sourceId: value(values, 1),
      title: value(values, 3),
      description: stripHtml(value(values, 6) || value(values, 5)),
      author: nullText(value(values, 31)),
      language: value(values, 12),
      year: numberOrNull(value(values, 13)),
      isbn: value(values, 22),
      city: value(values, 24),
      pageCount: numberOrNull(value(values, 25)),
      keywords: nullText(value(values, 27)),
      viewerUrl: value(values, 19) || value(values, 7),
      fileName: value(values, 20)
    };
  }).filter((row) => row.sourceId && row.title && row.viewerUrl);
}

export async function resolvePdfUrl(viewerUrl: string): Promise<string> {
  const parsed = new URL(viewerUrl);
  if (parsed.hostname !== "designrr.page") throw new Error("The spreadsheet contains an unsupported viewer host.");
  const response = await fetch(parsed, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`The book viewer returned HTTP ${response.status}.`);
  const html = await response.text();
  const match = html.match(/btnDownloadPdf:\s*\{[\s\S]*?url:\s*["']([^"']+\.pdf)["']/i);
  if (!match?.[1]) throw new Error("No downloadable PDF was found in the book viewer.");
  const pdfUrl = new URL(match[1], parsed).toString();
  if (new URL(pdfUrl).hostname !== "designrr.s3.amazonaws.com") {
    throw new Error("The resolved PDF host is not trusted.");
  }
  return pdfUrl;
}

function parseSharedStrings(xml: string): string[] {
  const parsed = parser.parse(xml) as { sst?: { si?: any[] } };
  const items = parsed.sst?.si ?? [];
  return items.map((item) => {
    const parts = Array.isArray(item.t) ? item.t : item.t ? [item.t] : [];
    return parts.map((part: unknown) => typeof part === "string" ? part : String(part ?? "")).join("");
  });
}

function columnNumber(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  return [...letters].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0);
}
function value(values: Map<number, string>, column: number): string { return values.get(column)?.trim() ?? ""; }
function nullText(value: string): string { return value === "NULL" ? "" : value; }
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}
function numberOrNull(value: string): number | null {
  const number = Number(value);
  return value && Number.isFinite(number) ? Math.round(number) : null;
}

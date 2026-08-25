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
    const sourceRowNumber = Number(row["@_r"]);
    const values = new Map<number, string>();
    const cells = Array.isArray(row.c) ? row.c : row.c ? [row.c] : [];
    for (const cell of cells) {
      const ref = String(cell["@_r"] ?? "");
      const col = columnNumber(ref);
      const raw = cell["@_t"] === "inlineStr" ? cell.is : cell.v;
      if (col && raw !== undefined) {
        const rawText = textValue(raw);
        values.set(col, cell["@_t"] === "s" ? shared[Number(rawText)] ?? "" : rawText);
      }
    }
    return {
      rowNumber: Number.isInteger(sourceRowNumber) && sourceRowNumber > 0 ? sourceRowNumber : index + 1,
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
  if (!isDesignrrHost(parsed.hostname) && !isTrustedPdfHost(parsed.hostname)) {
    throw new Error("The spreadsheet contains an unsupported viewer host.");
  }
  // Some exports contain the generated PDF URL directly. Avoid fetching the
  // viewer page in that case (and keep query strings such as signed S3 params).
  if (isPdfUrl(parsed)) return parsed.toString();

  const response = await fetch(parsed, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`The book viewer returned HTTP ${response.status}.`);
  const html = decodeEscapedUrlText(await response.text());
  // Designrr has used a few equivalent shapes for this value over time. Do
  // not require `url` to be inside btnDownloadPdf or `.pdf` to be last.
  const candidates = [
    ...html.matchAll(/(?:btnDownloadPdf|downloadPdf|pdfUrl|downloadUrl)[\s\S]{0,500}?url\s*:\s*["']([^"']+)["']/gi),
    ...html.matchAll(/["'](https?:\/\/[^"']+\.pdf(?:\?[^"']*)?)["']/gi)
  ];
  const candidate = candidates.map((match) => match[1]).find((url) => {
    if (!url) return false;
    try { return isTrustedPdfHost(new URL(url, parsed).hostname) && isPdfUrl(new URL(url, parsed)); } catch { return false; }
  });
  if (!candidate) throw new Error("No downloadable PDF was found in the book viewer.");
  const pdfUrl = new URL(candidate, parsed).toString();
  if (!isTrustedPdfHost(new URL(pdfUrl).hostname)) {
    throw new Error("The resolved PDF host is not trusted.");
  }
  return pdfUrl;
}

function isDesignrrHost(hostname: string): boolean {
  return hostname === "designrr.page" || hostname.endsWith(".designrr.page");
}

function isTrustedPdfHost(hostname: string): boolean {
  return hostname === "designrr.s3.amazonaws.com" || hostname === "s3.amazonaws.com";
}

function isPdfUrl(url: URL): boolean {
  return /\.pdf(?:$|[?#])/i.test(url.pathname + url.search + url.hash);
}

function decodeEscapedUrlText(value: string): string {
  return value
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/&amp;/gi, "&")
    .replace(/\\u003d/gi, "=");
}

function parseSharedStrings(xml: string): string[] {
  const parsed = parser.parse(xml) as { sst?: { si?: any[] } };
  const items = parsed.sst?.si ?? [];
  return items.map((item) => {
    return textValue(item.t ?? item.r ?? "");
  });
}

/**
 * fast-xml-parser represents text nodes with attributes (for example
 * `xml:space="preserve"`) as objects instead of strings. It can also return
 * rich-text runs as an array of objects. Never stringify those objects
 * directly, or the UI will receive the literal value "[object Object]".
 */
function textValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(textValue).join("");
  if (typeof value !== "object") return "";

  const object = value as Record<string, unknown>;
  if ("#text" in object) return textValue(object["#text"]);
  if ("t" in object) return textValue(object.t);
  if ("r" in object) return textValue(object.r);
  if ("is" in object) return textValue(object.is);
  return Object.entries(object)
    .filter(([key]) => !key.startsWith("@_") && key !== "rPr")
    .map(([, nested]) => textValue(nested))
    .join("");
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

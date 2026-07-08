/**
 * Magic-byte checks. Client-supplied extension/mimetype is easy to fake, so
 * anything we ingest based on its declared format is re-checked against the
 * actual file bytes before we trust it.
 */

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");
const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]), // empty archive
  Buffer.from([0x50, 0x4b, 0x07, 0x08]) // spanned archive
];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

function startsWithAny(buffer: Buffer, signatures: Buffer[]): boolean {
  return signatures.some((signature) => buffer.subarray(0, signature.length).equals(signature));
}

/** The PDF header may be preceded by a few bytes of junk; readers scan the first 1KB for it. */
function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 1024).includes(PDF_SIGNATURE);
}

function isZip(buffer: Buffer): boolean {
  return startsWithAny(buffer, ZIP_SIGNATURES);
}

function isPng(buffer: Buffer): boolean {
  return buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE);
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

/** EPUB and DOCX are both zip containers, so this only rules out non-zip payloads. */
export function matchesBookSourceFormat(buffer: Buffer, format: "pdf" | "epub" | "docx" | "txt"): boolean {
  switch (format) {
    case "pdf":
      return isPdf(buffer);
    case "epub":
    case "docx":
      return isZip(buffer);
    case "txt":
      // Plain text has no magic bytes; reject payloads that are actually one
      // of the binary formats above (e.g. a mislabeled/renamed PDF or zip).
      return !isPdf(buffer) && !isZip(buffer);
  }
}

export function matchesReceiptMimeType(buffer: Buffer, mimetype: string): boolean {
  switch (mimetype) {
    case "application/pdf":
      return isPdf(buffer);
    case "image/png":
      return isPng(buffer);
    case "image/jpeg":
    case "image/jpg":
      return isJpeg(buffer);
    case "image/webp":
      return isWebp(buffer);
    default:
      return false;
  }
}

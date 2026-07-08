import { extname } from "node:path";

export type SourceFormat = "pdf" | "epub" | "docx" | "txt";

export const DEFAULT_EXTENSIONS: Record<SourceFormat, string> = {
  pdf: ".pdf",
  epub: ".epub",
  docx: ".docx",
  txt: ".txt"
};

export const ACCEPTED_UPLOAD_TYPES: Record<SourceFormat, { mimeTypes: string[]; extensions: string[] }> = {
  pdf: {
    mimeTypes: ["application/pdf"],
    extensions: [".pdf"]
  },
  epub: {
    mimeTypes: ["application/epub+zip"],
    extensions: [".epub"]
  },
  docx: {
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    extensions: [".docx"]
  },
  txt: {
    mimeTypes: ["text/plain"],
    extensions: [".txt"]
  }
};

export const SOURCE_CONTENT_TYPES: Record<SourceFormat, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain"
};

/** Detect the source format from an uploaded file's name/mimetype. Extension wins when the
 * browser/OS reports a generic or missing mimetype (common for .epub/.docx uploads). */
export function detectSourceFormat(fileName: string, mimetype: string): SourceFormat | undefined {
  const ext = extname(fileName).toLowerCase();

  for (const format of Object.keys(ACCEPTED_UPLOAD_TYPES) as SourceFormat[]) {
    const spec = ACCEPTED_UPLOAD_TYPES[format];
    if (spec.mimeTypes.includes(mimetype) || spec.extensions.includes(ext)) {
      return format;
    }
  }

  return undefined;
}

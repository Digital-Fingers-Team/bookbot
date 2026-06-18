import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { env } from "../../config/env.js";
import { normalizeUploadedFileName } from "../../utils/file-name.js";

export type StoredPdf = {
  originalPdfPath: string;
  storageProvider: "local";
  uploadChecksum: string;
  uploadedAt: Date;
};

export async function storePdfSource(input: { buffer: Buffer; originalFileName: string }): Promise<StoredPdf> {
  const storageDir = resolve(env.PDF_STORAGE_DIR);
  await mkdir(storageDir, { recursive: true });

  const checksum = checksumBuffer(input.buffer);
  const safeName = safeStorageName(normalizeUploadedFileName(basename(input.originalFileName)));
  const extension = extname(safeName) || ".pdf";
  const base = safeName.slice(0, safeName.length - extension.length) || "book";
  const fileName = `${base}-${checksum.slice(0, 16)}${extension}`;
  const originalPdfPath = join(storageDir, fileName);

  await writeFile(originalPdfPath, input.buffer);

  return {
    originalPdfPath,
    storageProvider: "local",
    uploadChecksum: checksum,
    uploadedAt: new Date()
  };
}

export async function deleteStoredPdf(path?: string) {
  if (!path) {
    return;
  }

  await rm(path, { force: true }).catch(() => undefined);
}

function checksumBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeStorageName(fileName: string) {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/\s+/g, " ").trim() || "book.pdf";
}

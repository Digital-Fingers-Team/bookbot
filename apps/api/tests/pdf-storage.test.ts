import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("PDF source storage", () => {
  let storageDir: string;

  beforeEach(async () => {
    vi.resetModules();
    storageDir = await mkdtemp(join(tmpdir(), "aradobot-pdf-"));
    vi.stubEnv("PDF_STORAGE_DIR", storageDir);
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
  });

  it("persists source PDF metadata for future reprocessing", async () => {
    const { storePdfSource } = await import("../src/services/ingestion/pdf-storage.service.js");
    const buffer = Buffer.from("%PDF test content");
    const stored = await storePdfSource({ buffer, originalFileName: "Example.pdf" });

    expect(stored.storageProvider).toBe("local");
    expect(stored.uploadChecksum).toHaveLength(64);
    expect(stored.uploadedAt).toBeInstanceOf(Date);
    await expect(readFile(stored.originalPdfPath)).resolves.toEqual(buffer);
  });
});

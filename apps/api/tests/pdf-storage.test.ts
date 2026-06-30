import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("PDF source storage", () => {
  let storageDir: string;

  beforeEach(async () => {
    vi.resetModules();
    storageDir = await mkdtemp(join(tmpdir(), "aradobot-pdf-"));
    vi.stubEnv("STORAGE_DRIVER", "local");
    vi.stubEnv("STORAGE_LOCAL_DIR", storageDir);
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("persists the source PDF under a 'pdfs/' key, readable via the provider", async () => {
    const { storePdfSource } = await import("../src/services/ingestion/pdf-storage.service.js");
    const { storage } = await import("../src/services/storage/storage.service.js");
    const buffer = Buffer.from("%PDF test content");
    const stored = await storePdfSource({ buffer, originalFileName: "Example.pdf" });

    expect(stored.storageProvider).toBe("local");
    expect(stored.originalPdfPath).toMatch(/^pdfs\//);
    expect(stored.uploadChecksum).toHaveLength(64);
    expect(stored.uploadedAt).toBeInstanceOf(Date);
    await expect(storage.get(stored.originalPdfPath)).resolves.toEqual(buffer);
  });
});

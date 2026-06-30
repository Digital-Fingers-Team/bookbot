import mongoose from "mongoose";
import { env } from "../config/env.js";
import { makeStorage } from "../services/storage/storage.service.js";
import { Book } from "../models/book.model.js";
import { AccessRequest } from "../models/access-request.model.js";

/**
 * One-off migration: copy uploaded PDFs and payment receipts from local disk
 * into MongoDB (GridFS), so existing data survives redeploys like new uploads.
 * Idempotent — books already on gridfs and blobs already present are skipped.
 *
 * Run with:  npm run migrate:storage   (in apps/api)
 * Afterwards set STORAGE_DRIVER=gridfs so reads/writes use MongoDB.
 */
async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const local = makeStorage("local");
  const grid = makeStorage("gridfs");

  let booksMoved = 0;
  let booksMissing = 0;
  let receiptsMoved = 0;
  let receiptsMissing = 0;

  try {
    // --- Books (PDFs) ---
    const books = await Book.find(
      { originalPdfPath: { $nin: [null, ""] }, storageProvider: { $ne: "gridfs" } },
      { originalPdfPath: 1, storageProvider: 1 }
    );
    for (const book of books) {
      const key = book.originalPdfPath as string;
      const buffer = await readLocal(local, key, "pdfs");
      if (!buffer) {
        booksMissing += 1;
        console.warn(`! PDF not found on disk for book ${book._id} (${key})`);
        continue;
      }
      await grid.put(key, buffer, "application/pdf");
      book.storageProvider = "gridfs";
      await book.save();
      booksMoved += 1;
    }

    // --- Receipts ---
    const requests = await AccessRequest.find(
      { receiptFile: { $nin: [null, ""] } },
      { receiptFile: 1, receiptMime: 1 }
    );
    for (const request of requests) {
      const key = normalizeReceiptKey(request.receiptFile as string);
      if (await grid.exists(key)) {
        continue; // already migrated
      }
      const buffer = await readLocal(local, key, "receipts");
      if (!buffer) {
        receiptsMissing += 1;
        continue;
      }
      await grid.put(key, buffer, (request.receiptMime as string) || "application/octet-stream");
      receiptsMoved += 1;
    }

    console.log(
      `Done. Books moved: ${booksMoved} (missing ${booksMissing}); receipts moved: ${receiptsMoved} (missing ${receiptsMissing}).`
    );
  } finally {
    await mongoose.disconnect();
  }
}

function normalizeReceiptKey(value: string) {
  return value.includes("/") ? value : `receipts/${value}`;
}

// Read a blob from local storage, tolerating legacy keys (absolute paths or
// bare filenames) by retrying with a "<prefix>/<basename>" key.
async function readLocal(local: ReturnType<typeof makeStorage>, key: string, prefix: string) {
  try {
    return await local.get(key);
  } catch {
    try {
      return await local.get(`${prefix}/${key.split(/[/\\]/).pop()}`);
    } catch {
      return null;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

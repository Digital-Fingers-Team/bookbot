import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Chunk } from "../models/chunk.model.js";
import { cleanCorruptedText, normalizeText } from "../utils/text.js";

/**
 * One-off maintenance: re-clean OCR garble (repeated / space-split letters) in
 * already-stored chunks, so the existing library benefits from the same cleanup
 * newly uploaded books get. Updates the display + search text only; embeddings
 * are left as-is (they stay valid for retrieval).
 *
 * Run with:  npm run reclean:chunks   (in apps/api)
 */
async function main() {
  await mongoose.connect(env.MONGODB_URI);

  let scanned = 0;
  let updated = 0;

  try {
    const cursor = Chunk.find({}, { chunkText: 1, normalizedText: 1 }).cursor();
    for await (const chunk of cursor) {
      scanned += 1;
      const cleaned = cleanCorruptedText(chunk.chunkText);
      if (cleaned && cleaned !== chunk.chunkText) {
        chunk.chunkText = cleaned;
        chunk.normalizedText = normalizeText(cleaned);
        await chunk.save();
        updated += 1;
      }
      if (scanned % 500 === 0) {
        console.log(`…scanned ${scanned}, updated ${updated}`);
      }
    }

    console.log(`Done. Re-cleaned ${updated} of ${scanned} chunks.`);
  } catch (error) {
    console.error("Re-clean failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();

import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Book } from "../models/book.model.js";

/**
 * One-off migration: older books that finished processing before the `readyAt`
 * field existed have no activation date. Backfill it from `createdAt` (the best
 * available approximation) so the library shows an activation date for them too.
 *
 * Run with:  npm run backfill:ready-at   (in apps/api)
 */
async function main() {
  await mongoose.connect(env.MONGODB_URI);
  try {
    const result = await Book.updateMany(
      { status: "ready", readyAt: { $in: [null, undefined] } },
      [{ $set: { readyAt: "$createdAt" } }]
    );
    console.log(`Backfilled readyAt on ${result.modifiedCount} book(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

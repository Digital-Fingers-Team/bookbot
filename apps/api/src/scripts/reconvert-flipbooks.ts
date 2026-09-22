import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Book } from "../models/book.model.js";

/**
 * One-off migration: books converted before `share: false` was sent to Heyzine
 * still have a flipbook whose share button publishes the book's URL, letting a
 * reader hand it to someone our access checks never saw.
 *
 * The conversion settings live on Heyzine's side and are fixed at conversion
 * time, so the only way to apply them is to convert again. Clearing the cached
 * URL is enough: the /:id/heyzine route re-converts on the next open, which
 * spreads the work over real traffic instead of hammering the API in one burst.
 *
 * Readers opening a cleared book see the usual "opening book" wait once.
 *
 * Run with:  npx tsx src/scripts/reconvert-flipbooks.ts   (in apps/api)
 */
async function main() {
  // directConnection: Mongo runs in a container and advertises itself to the
  // replica set as "mongo", a name that resolves inside the container network
  // but not on the host. Without this the driver follows that advertised name
  // after connecting to the seed and fails with ReplicaSetNoPrimary.
  await mongoose.connect(env.MONGODB_URI, { directConnection: true });
  try {
    const result = await Book.updateMany(
      { heyzineUrl: { $exists: true, $nin: [null, ""] } },
      { $unset: { heyzineUrl: "", heyzineId: "" } }
    );
    console.log(`Cleared the cached flipbook on ${result.modifiedCount} book(s); each re-converts on next open.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

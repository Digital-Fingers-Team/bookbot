import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Chunk } from "../models/chunk.model.js";

async function main() {
  await mongoose.connect(env.MONGODB_URI);

  try {
    const indexes = (await Chunk.collection
      .aggregate([{ $listSearchIndexes: { name: env.ATLAS_VECTOR_INDEX_NAME } }])
      .toArray()) as Array<{ name?: string; status?: string; latestDefinition?: unknown }>;
    const index = indexes.find((candidate) => candidate.name === env.ATLAS_VECTOR_INDEX_NAME);

    if (!index) {
      throw new Error(`Atlas Vector Search index "${env.ATLAS_VECTOR_INDEX_NAME}" was not found.`);
    }

    console.log(`Vector index "${env.ATLAS_VECTOR_INDEX_NAME}" found with status: ${index.status ?? "unknown"}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Vector index check failed: ${message}\n` +
        "BookBot requires MongoDB Atlas Vector Search for retrieval. Local Docker MongoDB may not support $vectorSearch."
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();

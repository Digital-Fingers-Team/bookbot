import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export async function connectDatabase() {
  mongoose.set("strictQuery", true);

  // Surface connection lifecycle so a dropped Atlas link isn't silent. The
  // driver auto-reconnects; we just log the transitions.
  const connection = mongoose.connection;
  connection.on("error", (error) => logger.error({ err: error }, "MongoDB connection error"));
  connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  connection.on("reconnected", () => logger.info("MongoDB reconnected"));

  await mongoose.connect(env.MONGODB_URI, {
    // Index builds are skipped in production (don't rebuild on every boot); we
    // sync them explicitly via ensureIndexes() instead.
    autoIndex: env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 5_000,
    retryWrites: true,
    // The local Docker image advertises its container hostname (`mongo`),
    // which is not resolvable from the host. Keep topology discovery enabled
    // for Atlas, but connect directly when using the host-published endpoint.
    directConnection: isLocalMongoUri(env.MONGODB_URI)
  });

  logger.info("MongoDB connected");
}

function isLocalMongoUri(uri: string) {
  return /^mongodb(?:\+srv)?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/i.test(uri);
}

/**
 * Build any missing schema indexes for every registered model. Uses
 * createIndexes (create-only) — never drops, so it won't touch manually-created
 * or Atlas Search (vector) indexes. Safe on every boot and the only way
 * production collections get their indexes, since autoIndex is off there.
 * Non-fatal: failures are logged so the API still starts.
 */
export async function ensureIndexes() {
  const models = Object.values(mongoose.models);
  await Promise.all(
    models.map((model) =>
      model
        .createIndexes()
        .catch((error) => logger.warn({ err: error, model: model.modelName }, "Index sync failed"))
    )
  );
  logger.info(`Ensured indexes for ${models.length} model(s)`);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

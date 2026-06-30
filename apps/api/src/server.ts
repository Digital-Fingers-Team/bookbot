import { createApp } from "./app.js";
import { connectDatabase, ensureIndexes } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initSentry } from "./config/sentry.js";
import { seedDefaultAdmin } from "./services/auth/auth.service.js";
import { seedDefaultCategories } from "./models/category.model.js";
import { failStaleProcessingBooks } from "./services/ingestion/ingestion.service.js";

async function bootstrap() {
  initSentry();
  await connectDatabase();
  await seedDefaultAdmin();
  await seedDefaultCategories();
  await failStaleProcessingBooks();
  const app = createApp();
  // Models are all registered by now (createApp imports the routes). Build any
  // missing indexes — required in production where autoIndex is disabled.
  await ensureIndexes();

  app.listen(env.PORT, () => {
    logger.info(`AradoBot API listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  if (isMongoConnectionError(error)) {
    console.error(
      [
        "Failed to start AradoBot API: MongoDB is not reachable.",
        "",
        "Your .env points to MongoDB at:",
        `  ${safeMongoUri(env.MONGODB_URI)}`,
        "",
        "Start MongoDB, then run pnpm dev again.",
        "",
        "Options:",
        "  1. Docker Desktop: docker compose up -d mongo",
        "  2. Local MongoDB service: start the MongoDB Windows service",
        "  3. MongoDB Atlas: set MONGODB_URI to your cloud connection string"
      ].join("\n")
    );
    process.exit(1);
  }

  console.error("Failed to start API server", error);
  process.exit(1);
});

function isMongoConnectionError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "MongooseServerSelectionError" ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("Server selection timed out"))
  );
}

function safeMongoUri(value: string) {
  return value.replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:***@");
}

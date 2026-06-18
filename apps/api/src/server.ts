import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { seedDefaultAdmin } from "./services/auth/auth.service.js";

async function bootstrap() {
  await connectDatabase();
  await seedDefaultAdmin();
  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`BookBot API listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  if (isMongoConnectionError(error)) {
    console.error(
      [
        "Failed to start BookBot API: MongoDB is not reachable.",
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

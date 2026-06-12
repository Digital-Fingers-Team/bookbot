import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

async function bootstrap() {
  await connectDatabase();
  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`BookBotD API listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start API server", error);
  process.exit(1);
});

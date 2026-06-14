import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { seedDefaultAdmin } from "./services/auth/auth.service.js";

async function bootstrap() {
  await connectDatabase();
  await seedDefaultAdmin();
  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`BookBotD API listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start API server", error);
  process.exit(1);
});

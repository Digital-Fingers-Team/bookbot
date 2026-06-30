import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { httpLogger } from "./config/logger.js";
import { authLimiter, globalLimiter, uploadLimiter } from "./middleware/rate-limit.middleware.js";
import { authRouter } from "./routes/auth.routes.js";
import { accessRequestsRouter } from "./routes/access-requests.routes.js";
import { adminUsersRouter } from "./routes/admin-users.routes.js";
import { booksRouter } from "./routes/books.routes.js";
import { categoriesRouter } from "./routes/categories.routes.js";
import { chatRouter } from "./routes/chat.routes.js";
import { conversationsRouter } from "./routes/conversations.routes.js";
import { feedbackRouter } from "./routes/feedback.routes.js";
import { ompRouter } from "./routes/omp.routes.js";
import { statsRouter } from "./routes/stats.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { requireAuth } from "./middleware/auth.middleware.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  if (env.NODE_ENV !== "test") {
    app.use(httpLogger);
  }
  app.use(globalLimiter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/upload", uploadLimiter, uploadRouter);
  app.use("/api/chat", requireAuth, chatRouter);
  app.use("/api/books", booksRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/access-requests", accessRequestsRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/omp", ompRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

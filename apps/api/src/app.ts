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
import { orgAdminRouter } from "./routes/org-admin.routes.js";
import { organizationsRouter } from "./routes/organizations.routes.js";
import { statsRouter } from "./routes/stats.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { excelImportRouter } from "./routes/excel-import.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { requireAuth } from "./middleware/auth.middleware.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Browsers commonly use 127.0.0.1 when the app was opened from a
        // local development link, while the configured origin uses localhost.
        // Treat the two loopback names as equivalent in development only.
        const localOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;
        const allowed = !origin || origin === env.CLIENT_ORIGIN ||
          (env.NODE_ENV !== "production" && localOrigin.test(origin) && localOrigin.test(env.CLIENT_ORIGIN));
        callback(allowed ? null : new Error("CORS origin is not allowed"), allowed ? true : false);
      },
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
  app.use("/api/excel-import", uploadLimiter, excelImportRouter);
  app.use("/api/chat", requireAuth, chatRouter);
  app.use("/api/books", booksRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/access-requests", accessRequestsRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/organizations", organizationsRouter);
  app.use("/api/org-admin", orgAdminRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/omp", ompRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

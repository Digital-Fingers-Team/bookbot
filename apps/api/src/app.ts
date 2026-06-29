import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { booksRouter } from "./routes/books.routes.js";
import { categoriesRouter } from "./routes/categories.routes.js";
import { chatRouter } from "./routes/chat.routes.js";
import { conversationsRouter } from "./routes/conversations.routes.js";
import { feedbackRouter } from "./routes/feedback.routes.js";
import { ompRouter } from "./routes/omp.routes.js";
import { statsRouter } from "./routes/stats.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";

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
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/upload", uploadRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/books", booksRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/omp", ompRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { env } from "./env.js";

/** Structured app logger. JSON in prod; pretty when a TTY is attached. */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "aradobot-api" },
  redact: ["req.headers.authorization", "req.headers.cookie"],
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
      : undefined
});

/** Request logging + per-request id (echoed back as X-Request-Id). */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage, res: ServerResponse) => {
    const existing = (req.headers["x-request-id"] as string) || randomUUID();
    res.setHeader("X-Request-Id", existing);
    return existing;
  },
  // Health checks are noise.
  autoLogging: { ignore: (req: IncomingMessage) => req.url === "/health" }
});

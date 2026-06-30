import * as Sentry from "@sentry/node";
import { env } from "./env.js";
import { logger } from "./logger.js";

let enabled = false;

/** Initialise Sentry error tracking when SENTRY_DSN is configured (no-op otherwise). */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1
  });
  enabled = true;
  logger.info("Sentry error tracking enabled");
}

/** Report an error to Sentry when enabled; always safe to call. */
export function captureError(error: unknown): void {
  if (enabled) {
    Sentry.captureException(error);
  }
}

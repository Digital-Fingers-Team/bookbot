import type { NextFunction, Request, Response } from "express";
import { isApiError } from "../utils/api-error.js";
import { logger } from "../config/logger.js";
import { captureError } from "../config/sentry.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} was not found.`
    }
  });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (isApiError(error)) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  captureError(error);
  logger.error({ err: error }, "Unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong. Please try again."
    }
  });
}

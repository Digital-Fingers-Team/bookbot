import type { NextFunction, Request, Response } from "express";
import multer from "multer";
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

  if (error instanceof multer.MulterError) {
    const message = multerErrorMessage(error.code);
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({
      error: {
        code: error.code,
        message
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

function multerErrorMessage(code: multer.ErrorCode): string {
  switch (code) {
    case "LIMIT_FIELD_VALUE":
      return "The selected import data is too large. Select fewer books and try again.";
    case "LIMIT_FILE_SIZE":
      return "One of the uploaded files is too large.";
    case "LIMIT_FILE_COUNT":
      return "Too many files were uploaded.";
    case "LIMIT_UNEXPECTED_FILE":
      return "An unexpected upload field was received.";
    default:
      return "The upload could not be processed.";
  }
}

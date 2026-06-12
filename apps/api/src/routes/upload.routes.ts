import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { ingestPdf } from "../services/ingestion/ingestion.service.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_MB * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf" && !file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(new ApiError(400, "INVALID_FILE_TYPE", "Please upload a PDF file."));
      return;
    }
    cb(null, true);
  }
});

export const uploadRouter: ExpressRouter = Router();

uploadRouter.post(
  "/",
  requireAdmin,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, "MISSING_FILE", "Please choose a PDF file to upload.");
    }

    const result = await ingestPdf({
      buffer: req.file.buffer,
      originalFileName: req.file.originalname
    });

    res.status(201).json(result);
  })
);

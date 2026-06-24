import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { createProcessingBook } from "../services/ingestion/ingestion.service.js";
import { enqueueBookProcessing } from "../services/ingestion/processing-queue.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { normalizeUploadedFileName } from "../utils/file-name.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_MB * 1024 * 1024,
    files: env.UPLOAD_MAX_FILES
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
  upload.array("files", env.UPLOAD_MAX_FILES),
  asyncHandler(async (req, res) => {
    const files = req.files;
    if (!Array.isArray(files) || !files.length) {
      throw new ApiError(400, "MISSING_FILE", "Please choose at least one PDF file to upload.");
    }

    const books = [];
    for (const file of files) {
      const created = await createProcessingBook({
        buffer: file.buffer,
        originalFileName: normalizeUploadedFileName(file.originalname)
      });

      enqueueBookProcessing(created.bookId);

      books.push({
        bookId: created.bookId,
        title: created.title,
        originalFileName: created.originalFileName,
        status: created.status,
        pageCount: 0,
        chunkCount: 0
      });
    }

    res.status(201).json({ books });
  })
);

import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { createProcessingBook } from "../services/ingestion/ingestion.service.js";
import { enqueueBookProcessing } from "../services/ingestion/processing-queue.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { normalizeUploadedFileName } from "../utils/file-name.js";
import { detectSourceFormat } from "../utils/source-format.js";
import { matchesBookSourceFormat } from "../utils/file-signature.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_MB * 1024 * 1024,
    files: env.UPLOAD_MAX_FILES
  },
  fileFilter: (_req, file, cb) => {
    if (!detectSourceFormat(file.originalname, file.mimetype)) {
      cb(new ApiError(400, "INVALID_FILE_TYPE", "Please upload a PDF, EPUB, DOCX, or TXT file."));
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
      throw new ApiError(400, "MISSING_FILE", "Please choose at least one file to upload.");
    }

    // One price applies to the whole batch (admin sets it on the upload form).
    const rawPrice = Number(req.body?.price);
    const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;

    const books = [];
    for (const file of files) {
      // fileFilter already validated this file, so the format is always known here.
      const format = detectSourceFormat(file.originalname, file.mimetype)!;
      if (!matchesBookSourceFormat(file.buffer, format)) {
        throw new ApiError(
          400,
          "FILE_CONTENT_MISMATCH",
          `"${file.originalname}" doesn't look like a valid ${format.toUpperCase()} file.`
        );
      }

      const created = await createProcessingBook({
        buffer: file.buffer,
        originalFileName: normalizeUploadedFileName(file.originalname),
        price,
        format
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

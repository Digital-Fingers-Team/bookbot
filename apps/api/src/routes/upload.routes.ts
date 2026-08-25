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
import { attachSummaryAudio, isSummaryAudio } from "../services/storage/summary-audio.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_MB * 1024 * 1024,
    files: env.UPLOAD_MAX_FILES * 2
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "summaryAudios") {
      if (!isSummaryAudio(file.originalname, file.mimetype)) {
        cb(new ApiError(400, "INVALID_AUDIO_TYPE", "Please upload an MP3, M4A, WAV, OGG, WEBM, AAC, or FLAC audio file."));
        return;
      }
      cb(null, true);
      return;
    }
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
  upload.fields([
    { name: "files", maxCount: env.UPLOAD_MAX_FILES },
    { name: "summaryAudios", maxCount: env.UPLOAD_MAX_FILES }
  ]),
  asyncHandler(async (req, res) => {
    const uploadedFiles = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const files = uploadedFiles?.files;
    if (!Array.isArray(files) || !files.length) {
      throw new ApiError(400, "MISSING_FILE", "Please choose at least one file to upload.");
    }

    const audioFiles = uploadedFiles?.summaryAudios ?? [];
    let audioIndexes: number[] = [];
    if (req.body?.summaryAudioIndexes) {
      try {
        const parsed = JSON.parse(String(req.body.summaryAudioIndexes));
        audioIndexes = Array.isArray(parsed) ? parsed.map((value) => Number(value)) : [];
      } catch {
        throw new ApiError(400, "INVALID_AUDIO_MAPPING", "The summary audio files could not be matched to the books.");
      }
    }
    if (audioFiles.length !== audioIndexes.length || new Set(audioIndexes).size !== audioIndexes.length || audioIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= files.length)) {
      throw new ApiError(400, "INVALID_AUDIO_MAPPING", "The summary audio files could not be matched to the books.");
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

      const audioPosition = audioIndexes.indexOf(files.indexOf(file));
      const audio = audioPosition >= 0 ? audioFiles[audioPosition] : undefined;
      if (audio) {
        await attachSummaryAudio(created.bookId, {
          buffer: audio.buffer,
          originalFileName: normalizeUploadedFileName(audio.originalname),
          mimeType: audio.mimetype
        });
      }

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

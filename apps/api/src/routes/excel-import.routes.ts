import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { parseBooksExcel, resolvePdfUrl, type ExcelBookRow } from "../services/import/excel-book-import.service.js";
import { createProcessingBook } from "../services/ingestion/ingestion.service.js";
import { enqueueBookProcessing } from "../services/ingestion/processing-queue.js";
import { normalizeUploadedFileName } from "../utils/file-name.js";
import { Book } from "../models/book.model.js";
import { Category } from "../models/category.model.js";
import { attachSummaryAudio, isSummaryAudio } from "../services/storage/summary-audio.service.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
const audioUpload = multer({
  storage: multer.memoryStorage(),
  // The selected rows are sent as one multipart text field. A workbook with
  // long descriptions can legitimately produce several megabytes of JSON,
  // which is larger than busboy's 1 MB default field limit.
  limits: {
    fileSize: env.UPLOAD_MAX_MB * 1024 * 1024,
    files: 100,
    fieldSize: 16 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!isSummaryAudio(file.originalname, file.mimetype)) {
      cb(new ApiError(400, "INVALID_AUDIO_TYPE", "Please upload an MP3, M4A, WAV, OGG, WEBM, AAC, or FLAC audio file."));
      return;
    }
    cb(null, true);
  }
});
export const excelImportRouter: ExpressRouter = Router();

excelImportRouter.post("/preview", requireAdmin, upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file || !/\.xlsx$/i.test(req.file.originalname)) throw new ApiError(400, "INVALID_EXCEL", "Please upload an .xlsx file.");
  let rows: ExcelBookRow[];
  try { rows = await parseBooksExcel(req.file.buffer); } catch { throw new ApiError(400, "INVALID_EXCEL", "The workbook could not be read."); }
  res.json({ total: rows.length, rows });
}));

excelImportRouter.post("/import", requireAdmin, audioUpload.array("summaryAudios", 100), asyncHandler(async (req, res) => {
  let rows: ExcelBookRow[];
  try {
    rows = Array.isArray(req.body?.rows) ? req.body.rows as ExcelBookRow[] : JSON.parse(String(req.body?.rows ?? "")) as ExcelBookRow[];
  } catch {
    throw new ApiError(400, "INVALID_ROWS", "The selected books could not be read.");
  }
  if (!Array.isArray(rows) || !rows.length) throw new ApiError(400, "NO_ROWS", "Select at least one book.");
  if (rows.length > 100) throw new ApiError(400, "TOO_MANY_ROWS", "Import at most 100 books at a time.");
  const audioFiles = (req.files as Express.Multer.File[] | undefined) ?? [];
  let audioRowNumbers: number[] = [];
  if (req.body?.summaryAudioRowNumbers) {
    try {
      const parsed = JSON.parse(String(req.body.summaryAudioRowNumbers));
      audioRowNumbers = Array.isArray(parsed) ? parsed.map((value) => Number(value)) : [];
    } catch {
      throw new ApiError(400, "INVALID_AUDIO_MAPPING", "The summary audio files could not be matched to the books.");
    }
  }
  const rowNumbers = new Set(rows.map((row) => row.rowNumber));
  if (
    audioFiles.length !== audioRowNumbers.length ||
    new Set(audioRowNumbers).size !== audioRowNumbers.length ||
    audioRowNumbers.some((rowNumber) => !Number.isInteger(rowNumber) || !rowNumbers.has(rowNumber))
  ) {
    throw new ApiError(400, "INVALID_AUDIO_MAPPING", "The summary audio files could not be matched to the books.");
  }
  const audioByRowNumber = new Map(audioRowNumbers.map((rowNumber, index) => [rowNumber, audioFiles[index]]));
  const results = await Promise.all(rows.map(async (row) => {
    try {
      if (row.sourceId && await Book.exists({ externalSourceId: row.sourceId })) {
        throw new Error("This book is already in the library.");
      }
      const pdfUrl = await resolvePdfUrl(String(row.viewerUrl));
      const category = typeof row.category === "string" ? row.category.trim().slice(0, 80) : "";
      if (category && !(await Category.exists({ name: category }))) {
        throw new Error("The selected category does not exist.");
      }
      const response = await fetch(pdfUrl, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`PDF download returned HTTP ${response.status}.`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const created = await createProcessingBook({
        buffer,
        originalFileName: normalizeUploadedFileName(row.fileName || `${row.title}.pdf`),
        format: "pdf",
        externalSourceId: row.sourceId,
        title: row.title,
        author: row.author,
        description: row.description,
        category,
        price: Number.isFinite(Number(row.price)) && Number(row.price) > 0 ? Number(row.price) : 0
      });
      const audio = audioByRowNumber.get(row.rowNumber);
      if (audio) {
        await attachSummaryAudio(created.bookId, {
          buffer: audio.buffer,
          originalFileName: normalizeUploadedFileName(audio.originalname),
          mimeType: audio.mimetype
        });
      }
      enqueueBookProcessing(created.bookId);
      return { book: { bookId: created.bookId, title: created.title, rowNumber: row.rowNumber } };
    } catch (error) {
      return { error: { rowNumber: row.rowNumber, title: row.title, error: error instanceof Error ? error.message : "Import failed." } };
    }
  }));
  const books = results.flatMap((result) => result.book ? [result.book] : []);
  const errors = results.flatMap((result) => result.error ? [result.error] : []);
  res.status(201).json({ books, errors });
}));

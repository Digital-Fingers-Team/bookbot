import { Router, type Router as ExpressRouter } from "express";
import { access, readFile } from "node:fs/promises";
import { isValidObjectId } from "mongoose";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import { Book } from "../models/book.model.js";
import { Chunk } from "../models/chunk.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { normalizeUploadedFileName, readableBookTitle } from "../utils/file-name.js";
import { excerpt } from "../utils/text.js";
import { deleteStoredPdf } from "../services/ingestion/pdf-storage.service.js";

export const booksRouter: ExpressRouter = Router();

booksRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const books = await Book.find(
      {},
      { title: 1, originalFileName: 1, createdAt: 1, chunkCount: 1, pageCount: 1, status: 1, processedPages: 1, error: 1, category: 1 }
    )
      .sort({ createdAt: -1 })
      .lean();
    const bookIds = books.map((book) => book._id);
    const firstPageChunks = await Chunk.find(
      { bookId: { $in: bookIds }, pageNumber: 1 },
      { bookId: 1, chunkText: 1 },
      { lean: true }
    );
    const firstPageByBookId = new Map(firstPageChunks.map((chunk) => [String(chunk.bookId), excerpt(chunk.chunkText, 220)]));

    res.json({
      books: books.map((book) => {
        const firstPageText = firstPageByBookId.get(String(book._id)) ?? "";

        return {
          id: String(book._id),
          title: readableBookTitle({
            title: book.title,
            originalFileName: book.originalFileName,
            firstPageText
          }),
          originalFileName: normalizeUploadedFileName(book.originalFileName),
          createdAt: book.createdAt,
          chunkCount: book.chunkCount,
          pageCount: book.pageCount,
          status: book.status ?? "ready",
          processedPages: book.processedPages ?? 0,
          error: book.error ?? "",
          author: "Unknown author",
          category: book.category ?? "",
          firstPageText
        };
      })
    });
  })
);

booksRouter.get(
  "/:id/pdf",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookPdf(routeId(req.params.id));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", contentDisposition(normalizeUploadedFileName(book.originalFileName)));
    res.sendFile(book.originalPdfPath);
  })
);

booksRouter.get(
  "/:id/pdf-data",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookPdf(routeId(req.params.id));
    const buffer = await readFile(book.originalPdfPath);

    res.json({
      fileName: normalizeUploadedFileName(book.originalFileName),
      mimeType: "application/pdf",
      data: buffer.toString("base64")
    });
  })
);

booksRouter.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_BOOK_ID", "The book id is invalid.");
    }

    const category = typeof req.body?.category === "string" ? req.body.category.trim().slice(0, 80) : undefined;
    if (category === undefined) {
      throw new ApiError(400, "INVALID_BOOK_UPDATE", "Nothing to update.");
    }

    const book = await Book.findByIdAndUpdate(req.params.id, { category }, { new: true });
    if (!book) {
      throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    }

    res.json({ id: String(book._id), category: book.category ?? "" });
  })
);

booksRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_BOOK_ID", "The book id is invalid.");
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    }

    await Chunk.deleteMany({ bookId: book._id });
    await deleteStoredPdf(book.originalPdfPath ?? undefined);
    await book.deleteOne();

    res.json({ deleted: true });
  })
);

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "book.pdf";
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function routeId(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function findBookPdf(id: string) {
  if (!isValidObjectId(id)) {
    throw new ApiError(400, "INVALID_BOOK_ID", "The book id is invalid.");
  }

  const book = await Book.findById(id, { originalPdfPath: 1, originalFileName: 1 }).lean();
  if (!book) {
    throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
  }

  if (!book.originalPdfPath) {
    throw new ApiError(404, "PDF_NOT_AVAILABLE", "The original PDF is not available for this book.");
  }

  try {
    await access(book.originalPdfPath);
  } catch {
    throw new ApiError(404, "PDF_NOT_AVAILABLE", "The original PDF file could not be found.");
  }

  return {
    originalPdfPath: book.originalPdfPath,
    originalFileName: book.originalFileName
  };
}

import { Router, type Router as ExpressRouter } from "express";
import { access, readFile } from "node:fs/promises";
import { isValidObjectId } from "mongoose";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import { Book } from "../models/book.model.js";
import { BookState } from "../models/book-state.model.js";
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
  asyncHandler(async (req, res) => {
    const books = await Book.find(
      {},
      { title: 1, originalFileName: 1, createdAt: 1, chunkCount: 1, pageCount: 1, status: 1, processedPages: 1, error: 1, category: 1, author: 1 }
    )
      .sort({ createdAt: -1 })
      .lean();
    const bookIds = books.map((book) => book._id);
    const [firstPageChunks, favoriteStates] = await Promise.all([
      Chunk.find({ bookId: { $in: bookIds }, pageNumber: 1 }, { bookId: 1, chunkText: 1 }, { lean: true }),
      BookState.find({ userId: req.user!.id, favorite: true }, { bookId: 1 }).lean()
    ]);
    const firstPageByBookId = new Map(firstPageChunks.map((chunk) => [String(chunk.bookId), excerpt(chunk.chunkText, 220)]));
    const favoriteIds = new Set(favoriteStates.map((state) => String(state.bookId)));

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
          author: book.author ?? "",
          category: book.category ?? "",
          favorite: favoriteIds.has(String(book._id)),
          firstPageText
        };
      })
    });
  })
);

const BOOK_CARD_FIELDS = {
  title: 1,
  originalFileName: 1,
  createdAt: 1,
  chunkCount: 1,
  pageCount: 1,
  status: 1,
  processedPages: 1,
  error: 1,
  category: 1,
  author: 1
} as const;

type BookStateLean = { favorite?: boolean; lastPage?: number; lastOpenedAt?: Date | null } | null | undefined;

function bookCard(book: Record<string, unknown>, firstPageText: string, state: BookStateLean) {
  return {
    id: String(book._id),
    title: readableBookTitle({
      title: book.title as string,
      originalFileName: book.originalFileName as string,
      firstPageText
    }),
    originalFileName: normalizeUploadedFileName(book.originalFileName as string),
    createdAt: book.createdAt,
    chunkCount: book.chunkCount,
    pageCount: book.pageCount,
    status: (book.status as string) ?? "ready",
    processedPages: book.processedPages ?? 0,
    error: book.error ?? "",
    author: (book.author as string) ?? "",
    category: (book.category as string) ?? "",
    firstPageText,
    favorite: state?.favorite ?? false,
    lastPage: state?.lastPage ?? 1,
    lastOpenedAt: state?.lastOpenedAt ?? null
  };
}

// The signed-in user's favorites + recently opened books ("My Books").
booksRouter.get(
  "/my",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const states = await BookState.find({ userId }).lean();
    if (!states.length) {
      res.json({ favorites: [], continueReading: [] });
      return;
    }

    const bookIds = states.map((state) => state.bookId);
    const [books, firstPageChunks] = await Promise.all([
      Book.find({ _id: { $in: bookIds } }, BOOK_CARD_FIELDS).lean(),
      Chunk.find({ bookId: { $in: bookIds }, pageNumber: 1 }, { bookId: 1, chunkText: 1 }, { lean: true })
    ]);
    const firstPageByBookId = new Map(firstPageChunks.map((chunk) => [String(chunk.bookId), excerpt(chunk.chunkText, 220)]));
    const stateByBook = new Map(states.map((state) => [String(state.bookId), state]));

    const cards = books.map((book) =>
      bookCard(book, firstPageByBookId.get(String(book._id)) ?? "", stateByBook.get(String(book._id)))
    );

    res.json({
      favorites: cards.filter((card) => card.favorite),
      continueReading: cards
        .filter((card) => card.lastOpenedAt)
        .sort((a, b) => new Date(b.lastOpenedAt as Date).getTime() - new Date(a.lastOpenedAt as Date).getTime())
    });
  })
);

// A single book with the current user's state, for the reading view.
booksRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_BOOK_ID", "The book id is invalid.");
    }

    const book = await Book.findById(req.params.id, BOOK_CARD_FIELDS).lean();
    if (!book) {
      throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    }

    const [firstPage, state] = await Promise.all([
      Chunk.findOne({ bookId: req.params.id, pageNumber: 1 }, { chunkText: 1 }).lean(),
      BookState.findOne({ userId: req.user!.id, bookId: req.params.id }).lean()
    ]);

    res.json(bookCard(book, firstPage ? excerpt(firstPage.chunkText, 220) : "", state));
  })
);

booksRouter.put(
  "/:id/favorite",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_BOOK_ID", "The book id is invalid.");
    }
    const favorite = Boolean(req.body?.favorite);
    await BookState.findOneAndUpdate(
      { userId: req.user!.id, bookId: req.params.id },
      { favorite },
      { upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ favorite });
  })
);

booksRouter.put(
  "/:id/progress",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_BOOK_ID", "The book id is invalid.");
    }
    const lastPage = Math.max(1, Math.floor(Number(req.body?.lastPage) || 1));
    await BookState.findOneAndUpdate(
      { userId: req.user!.id, bookId: req.params.id },
      { lastPage, lastOpenedAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true });
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

    const update: { category?: string; author?: string } = {};
    if (typeof req.body?.category === "string") {
      update.category = req.body.category.trim().slice(0, 80);
    }
    if (typeof req.body?.author === "string") {
      update.author = req.body.author.trim().slice(0, 120);
    }
    if (Object.keys(update).length === 0) {
      throw new ApiError(400, "INVALID_BOOK_UPDATE", "Nothing to update.");
    }

    const book = await Book.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!book) {
      throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    }

    res.json({ id: String(book._id), category: book.category ?? "", author: book.author ?? "" });
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
    await BookState.deleteMany({ bookId: book._id });
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

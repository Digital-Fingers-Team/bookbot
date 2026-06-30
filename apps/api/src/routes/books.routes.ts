import { Router, type Router as ExpressRouter } from "express";
import { access, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { isValidObjectId } from "mongoose";
import { env } from "../config/env.js";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import { requireBookAccess } from "../middleware/access.middleware.js";
import { allowedBookIdList, canAccessBook, resolveAccessScope } from "../services/access/access.service.js";
import { Book } from "../models/book.model.js";
import { BookState } from "../models/book-state.model.js";
import { Chunk } from "../models/chunk.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { normalizeUploadedFileName, readableBookTitle } from "../utils/file-name.js";
import { excerpt } from "../utils/text.js";
import { deleteStoredPdf } from "../services/ingestion/pdf-storage.service.js";
import { PdfJsRenderer } from "../services/ingestion/renderers/pdfjs.renderer.js";

export const booksRouter: ExpressRouter = Router();

booksRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    // The library shows the whole catalog; `accessible` marks which books the
    // user may actually open (admins / granted books / granted categories).
    const scope = await resolveAccessScope(req.user!);
    const books = await Book.find(
      {},
      { title: 1, originalFileName: 1, createdAt: 1, readyAt: 1, chunkCount: 1, pageCount: 1, status: 1, processedPages: 1, error: 1, category: 1, author: 1, featured: 1, description: 1, price: 1 }
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
          readyAt: book.readyAt ?? null,
          chunkCount: book.chunkCount,
          pageCount: book.pageCount,
          status: book.status ?? "ready",
          processedPages: book.processedPages ?? 0,
          error: book.error ?? "",
          author: book.author ?? "",
          category: book.category ?? "",
          favorite: favoriteIds.has(String(book._id)),
          featured: Boolean(book.featured),
          description: book.description ?? "",
          price: book.price ?? 0,
          accessible: canAccessBook(scope, String(book._id)),
          firstPageText
        };
      })
    });
  })
);

/**
 * Public showcase of ready books for the marketing landing carousel (no auth).
 * Returns only display fields (id/title/author) — no content.
 */
booksRouter.get(
  "/showcase",
  asyncHandler(async (req, res) => {
    const rawCount = Number(req.query.count);
    const count = Number.isFinite(rawCount) && rawCount > 0 ? Math.min(rawCount, 30) : 12;
    const books = await Book.find(
      { status: "ready", featured: true },
      { title: 1, originalFileName: 1, author: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(count)
      .lean();

    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({
      books: books.map((book) => ({
        id: String(book._id),
        title: readableBookTitle({ title: book.title, originalFileName: book.originalFileName, firstPageText: "" }),
        author: book.author ?? ""
      }))
    });
  })
);

/**
 * Lightweight typeahead over the whole catalog (id/title/author/category only).
 * Backs the admin "grant access" picker and the user "request access" picker so
 * neither has to load thousands of books into a <select>. No book content here.
 */
booksRouter.get(
  "/catalog",
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;

    const filter: Record<string, unknown> = { status: "ready" };
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(safe, "i");
      filter.$or = [{ title: rx }, { originalFileName: rx }, { author: rx }];
    }

    const books = await Book.find(filter, { title: 1, originalFileName: 1, author: 1, category: 1 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      books: books.map((book) => ({
        id: String(book._id),
        title: readableBookTitle({ title: book.title, originalFileName: book.originalFileName, firstPageText: "" }),
        author: book.author ?? "",
        category: book.category ?? ""
      }))
    });
  })
);

const BOOK_CARD_FIELDS = {
  title: 1,
  originalFileName: 1,
  createdAt: 1,
  readyAt: 1,
  chunkCount: 1,
  pageCount: 1,
  status: 1,
  processedPages: 1,
  error: 1,
  category: 1,
  author: 1,
  description: 1,
  featured: 1,
  price: 1
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
    readyAt: book.readyAt ?? null,
    chunkCount: book.chunkCount,
    pageCount: book.pageCount,
    status: (book.status as string) ?? "ready",
    processedPages: book.processedPages ?? 0,
    error: book.error ?? "",
    author: (book.author as string) ?? "",
    category: (book.category as string) ?? "",
    description: (book.description as string) ?? "",
    featured: Boolean(book.featured),
    price: (book.price as number) ?? 0,
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
    const scope = await resolveAccessScope(req.user!);
    const states = await BookState.find({ userId }).lean();

    // "Owned" = books the user purchased (granted books + books in granted
    // categories). Admins own everything, so we leave their owned list empty —
    // they browse the full catalog from the library instead.
    const ownedIds = scope.all ? [] : allowedBookIdList(scope) ?? [];
    const ownedSet = new Set(ownedIds);

    const stateBookIds = states.map((state) => String(state.bookId));
    const allIds = Array.from(new Set([...stateBookIds, ...ownedIds]));
    if (!allIds.length) {
      res.json({ favorites: [], continueReading: [], owned: [] });
      return;
    }

    const [books, firstPageChunks] = await Promise.all([
      Book.find({ _id: { $in: allIds } }, BOOK_CARD_FIELDS).lean(),
      Chunk.find({ bookId: { $in: allIds }, pageNumber: 1 }, { bookId: 1, chunkText: 1 }, { lean: true })
    ]);
    const firstPageByBookId = new Map(firstPageChunks.map((chunk) => [String(chunk.bookId), excerpt(chunk.chunkText, 220)]));
    const stateByBook = new Map(states.map((state) => [String(state.bookId), state]));

    const cards = books.map((book) => ({
      ...bookCard(book, firstPageByBookId.get(String(book._id)) ?? "", stateByBook.get(String(book._id))),
      accessible: canAccessBook(scope, String(book._id))
    }));

    res.json({
      favorites: cards.filter((card) => card.favorite),
      continueReading: cards
        .filter((card) => card.lastOpenedAt)
        .sort((a, b) => new Date(b.lastOpenedAt as Date).getTime() - new Date(a.lastOpenedAt as Date).getTime()),
      owned: cards.filter((card) => ownedSet.has(card.id))
    });
  })
);

// A single book with the current user's state, for the reading view.
booksRouter.get(
  "/:id",
  requireAuth,
  requireBookAccess,
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
  requireBookAccess,
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
  requireBookAccess,
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
  requireBookAccess,
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
  requireBookAccess,
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

booksRouter.get(
  "/:id/pages/:page/image",
  requireAuth,
  requireBookAccess,
  asyncHandler(async (req, res) => {
    const book = await findBookPdf(routeId(req.params.id));
    const pageNumber = Math.max(1, Math.floor(Number(req.params.page) || 1));
    const scale = Math.min(Math.max(Number(req.query.scale) || 2, 0.75), 3);
    const buffer = await readFile(book.originalPdfPath);
    const renderer = await new PdfJsRenderer().open(buffer);

    try {
      if (pageNumber > renderer.pageCount) {
        throw new ApiError(404, "PAGE_NOT_FOUND", "This page was not found.");
      }

      const rendered = await renderer.renderPage(pageNumber, scale);
      res.setHeader("Content-Type", rendered.mimeType);
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.setHeader("X-Page-Number", String(rendered.pageNumber));
      res.send(rendered.image);
    } finally {
      await renderer.close?.();
    }
  })
);

/**
 * Public cover image (first page) for the landing showcase carousel (no auth).
 * Publicly cacheable since it only exposes a book's front page.
 */
booksRouter.get(
  "/:id/cover",
  asyncHandler(async (req, res) => {
    const book = await findBookPdf(routeId(req.params.id));
    const buffer = await readFile(book.originalPdfPath);
    const renderer = await new PdfJsRenderer().open(buffer);

    try {
      const rendered = await renderer.renderPage(1, 1.5);
      res.setHeader("Content-Type", rendered.mimeType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(rendered.image);
    } finally {
      await renderer.close?.();
    }
  })
);

booksRouter.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, "INVALID_BOOK_ID", "The book id is invalid.");
    }

    const update: { category?: string; author?: string; featured?: boolean; description?: string; price?: number } = {};
    if (typeof req.body?.category === "string") {
      update.category = req.body.category.trim().slice(0, 80);
    }
    if (req.body?.price !== undefined) {
      const price = Number(req.body.price);
      update.price = Number.isFinite(price) && price > 0 ? price : 0;
    }
    if (typeof req.body?.author === "string") {
      update.author = req.body.author.trim().slice(0, 120);
    }
    if (typeof req.body?.featured === "boolean") {
      update.featured = req.body.featured;
    }
    if (typeof req.body?.description === "string") {
      update.description = req.body.description.trim().slice(0, 600);
    }
    if (Object.keys(update).length === 0) {
      throw new ApiError(400, "INVALID_BOOK_UPDATE", "Nothing to update.");
    }

    const book = await Book.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!book) {
      throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    }

    res.json({
      id: String(book._id),
      category: book.category ?? "",
      author: book.author ?? "",
      featured: Boolean(book.featured),
      description: book.description ?? "",
      price: book.price ?? 0
    });
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

  // Tolerate a stored absolute path that no longer exists (e.g. the repo moved)
  // by falling back to the current storage dir + filename.
  let pdfPath = book.originalPdfPath;
  try {
    await access(pdfPath);
  } catch {
    pdfPath = resolve(env.PDF_STORAGE_DIR, basename(book.originalPdfPath));
    try {
      await access(pdfPath);
    } catch {
      throw new ApiError(404, "PDF_NOT_AVAILABLE", "The original PDF file could not be found.");
    }
  }

  return {
    originalPdfPath: pdfPath,
    originalFileName: book.originalFileName
  };
}

import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { storage } from "../services/storage/storage.service.js";
import { optionalAuth, requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import { requireBookAccess, requireDownloadAccess, requireProtectedContentAccess } from "../middleware/access.middleware.js";
import { allowedBookIdList, canAccessBook, canDownloadBook, resolveAccessScope } from "../services/access/access.service.js";
import { resolveClientIp, resolveNetworkBookAccess, resolveNetworkBookIds } from "../services/access/network-policy.service.js";
import { Book } from "../models/book.model.js";
import { Category } from "../models/category.model.js";
import { BookState } from "../models/book-state.model.js";
import { BookPage } from "../models/book-page.model.js";
import { Chunk } from "../models/chunk.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { normalizeUploadedFileName, readableBookTitle } from "../utils/file-name.js";
import { requireBookId } from "../utils/object-id.js";
import { escapeRegExp, excerpt } from "../utils/text.js";
import { deleteStoredPdf } from "../services/ingestion/pdf-storage.service.js";
import { PdfJsRenderer } from "../services/ingestion/renderers/pdfjs.renderer.js";
import { renderPlaceholderCover } from "../services/ingestion/placeholder-cover.service.js";
import { SOURCE_CONTENT_TYPES, type SourceFormat } from "../utils/source-format.js";
import { attachSummaryAudio, isSummaryAudio, removeSummaryAudio, summaryAudioMeta } from "../services/storage/summary-audio.service.js";

const summaryAudioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isSummaryAudio(file.originalname, file.mimetype)) {
      cb(new ApiError(400, "INVALID_AUDIO_TYPE", "Please upload an MP3, M4A, WAV, OGG, WEBM, AAC, or FLAC audio file."));
      return;
    }
    cb(null, true);
  }
});

export const booksRouter: ExpressRouter = Router();

booksRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    // The library shows the whole catalog; `accessible` marks which books the
    // user may actually open (admins / granted books / granted categories).
    const scope = req.user ? await resolveAccessScope(req.user) : null;
    const networkBookIds = req.user ? null : await resolveNetworkBookIds(resolveClientIp(req));
    const books = await Book.find(
      {},
      { title: 1, originalFileName: 1, sourceFormat: 1, createdAt: 1, readyAt: 1, chunkCount: 1, pageCount: 1, status: 1, processedPages: 1, error: 1, category: 1, categories: 1, author: 1, featured: 1, description: 1, price: 1, summaryAudioFileName: 1, summaryAudioMimeType: 1, summaryAudioSize: 1, summaryAudioUploadedAt: 1 }
    )
      .sort({ createdAt: -1 })
      .lean();
    const bookIds = books.map((book) => book._id);
    const [firstPageChunks, favoriteStates] = await Promise.all([
      Chunk.find({ bookId: { $in: bookIds }, pageNumber: 1 }, { bookId: 1, chunkText: 1 }, { lean: true }),
      req.user ? BookState.find({ userId: req.user.id, favorite: true }, { bookId: 1 }).lean() : []
    ]);
    const firstPageByBookId = new Map(firstPageChunks.map((chunk) => [String(chunk.bookId), excerpt(chunk.chunkText, 220)]));
    const favoriteIds = new Set(favoriteStates.map((state) => String(state.bookId)));

    res.json({
      books: books.map((book) => {
        const firstPageText = firstPageByBookId.get(String(book._id)) ?? "";
        const accessible = scope ? canAccessBook(scope, String(book._id)) : networkBookIds!.has(String(book._id));
        const visibleFirstPageText = req.user || accessible ? firstPageText : "";

        return {
          id: String(book._id),
          title: readableBookTitle({
            title: book.title,
            originalFileName: book.originalFileName,
            firstPageText: visibleFirstPageText
          }),
          originalFileName: normalizeUploadedFileName(book.originalFileName),
          sourceFormat: book.sourceFormat ?? "pdf",
          createdAt: book.createdAt,
          readyAt: book.readyAt ?? null,
          chunkCount: book.chunkCount,
          pageCount: book.pageCount,
          status: book.status ?? "ready",
          processedPages: book.processedPages ?? 0,
          error: book.error ?? "",
          author: book.author ?? "",
          category: book.categories?.[0] ?? book.category ?? "",
          categories: normalizeCategories(book.categories, book.category),
          favorite: favoriteIds.has(String(book._id)),
          featured: Boolean(book.featured),
          description: book.description ?? "",
          price: book.price ?? 0,
          summaryAudio: summaryAudioMeta(book),
          accessible,
          firstPageText: visibleFirstPageText
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
      const rx = new RegExp(escapeRegExp(q), "i");
      filter.$or = [{ title: rx }, { originalFileName: rx }, { author: rx }];
    }

    const books = await Book.find(filter, { title: 1, originalFileName: 1, author: 1, category: 1, categories: 1 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      books: books.map((book) => ({
        id: String(book._id),
        title: readableBookTitle({ title: book.title, originalFileName: book.originalFileName, firstPageText: "" }),
        author: book.author ?? "",
        category: book.categories?.[0] ?? book.category ?? ""
      }))
    });
  })
);

const BOOK_CARD_FIELDS = {
  title: 1,
  originalFileName: 1,
  sourceFormat: 1,
  createdAt: 1,
  readyAt: 1,
  chunkCount: 1,
  pageCount: 1,
  status: 1,
  processedPages: 1,
  error: 1,
  category: 1,
  categories: 1,
  author: 1,
  description: 1,
  featured: 1,
  price: 1,
  heyzineId: 1,
  heyzineUrl: 1,
  summaryAudioFileName: 1,
  summaryAudioMimeType: 1,
  summaryAudioSize: 1,
  summaryAudioUploadedAt: 1
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
    sourceFormat: (book.sourceFormat as string) ?? "pdf",
    createdAt: book.createdAt,
    readyAt: book.readyAt ?? null,
    chunkCount: book.chunkCount,
    pageCount: book.pageCount,
    status: (book.status as string) ?? "ready",
    processedPages: book.processedPages ?? 0,
    error: book.error ?? "",
    author: (book.author as string) ?? "",
    category: normalizeCategories(book.categories as string[] | undefined, book.category as string | undefined)[0] ?? "",
    categories: normalizeCategories(book.categories as string[] | undefined, book.category as string | undefined),
    description: (book.description as string) ?? "",
    featured: Boolean(book.featured),
    price: (book.price as number) ?? 0,
    heyzineUrl: (book.heyzineUrl as string | undefined) ?? null,
    summaryAudio: summaryAudioMeta(book as {
      summaryAudioFileName?: string;
      summaryAudioMimeType?: string;
      summaryAudioSize?: number;
      summaryAudioUploadedAt?: Date;
    }),
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
  optionalAuth,
  requireProtectedContentAccess,
  asyncHandler(async (req, res) => {
    const bookId = requireBookId(routeId(req.params.id));

    const book = await Book.findById(bookId, BOOK_CARD_FIELDS).lean();
    if (!book) {
      throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    }

    const [firstPage, state, canDownload] = await Promise.all([
      Chunk.findOne({ bookId, pageNumber: 1 }, { chunkText: 1 }).lean(),
      req.user ? BookState.findOne({ userId: req.user.id, bookId }).lean() : null,
      req.user ? canDownloadBook(req.user, bookId) : false
    ]);

    const networkAccess = req.networkBookAccess ?? await resolveNetworkBookAccess(bookId, resolveClientIp(req));
    const networkDownload = networkAccess.allowed && networkAccess.downloadable;

    res.json({ ...bookCard(book, firstPage ? excerpt(firstPage.chunkText, 220) : "", state), canDownload: canDownload || networkDownload });
  })
);

booksRouter.put(
  "/:id/favorite",
  requireAuth,
  requireBookAccess,
  asyncHandler(async (req, res) => {
    requireBookId(req.params.id);
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
    requireBookId(req.params.id);
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
  optionalAuth,
  requireProtectedContentAccess,
  requireDownloadAccess,
  asyncHandler(async (req, res) => {
    const book = await findBookPdf(routeId(req.params.id));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", contentDisposition(normalizeUploadedFileName(book.originalFileName)));
    res.send(book.buffer);
  })
);

booksRouter.get(
  "/:id/pdf-data",
  optionalAuth,
  requireProtectedContentAccess,
  requireDownloadAccess,
  asyncHandler(async (req, res) => {
    const book = await findBookPdf(routeId(req.params.id));

    res.json({
      fileName: normalizeUploadedFileName(book.originalFileName),
      mimeType: "application/pdf",
      data: book.buffer.toString("base64")
    });
  })
);

booksRouter.get(
  "/:id/pages/:page/image",
  optionalAuth,
  requireProtectedContentAccess,
  asyncHandler(async (req, res) => {
    const book = await findBookPdf(routeId(req.params.id));
    const pageNumber = Math.max(1, Math.floor(Number(req.params.page) || 1));
    const scale = Math.min(Math.max(Number(req.query.scale) || 2, 0.75), 3);
    const renderer = await new PdfJsRenderer().open(book.buffer);

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
 * Page text for the non-PDF (EPUB/DOCX/TXT) reader, persisted at ingestion
 * time into `BookPage` — see `ingestion.service.ts`.
 */
booksRouter.get(
  "/:id/pages/:page/text",
  optionalAuth,
  requireProtectedContentAccess,
  asyncHandler(async (req, res) => {
    const id = requireBookId(routeId(req.params.id));
    const pageNumber = Math.max(1, Math.floor(Number(req.params.page) || 1));

    const page = await BookPage.findOne({ bookId: id, pageNumber }, { pageNumber: 1, text: 1 }).lean();
    if (!page) {
      throw new ApiError(404, "PAGE_NOT_FOUND", "This page was not found.");
    }

    res.json({ pageNumber: page.pageNumber, text: page.text });
  })
);

/**
 * Format-agnostic original-file download, for books that aren't PDFs (the
 * `/pdf` and `/pdf-data` routes above stay PDF-only and are used by the
 * existing PDF reader).
 */
booksRouter.get(
  "/:id/source",
  optionalAuth,
  requireProtectedContentAccess,
  requireDownloadAccess,
  asyncHandler(async (req, res) => {
    const book = await findBookSource(routeId(req.params.id));

    res.setHeader("Content-Type", SOURCE_CONTENT_TYPES[book.format]);
    res.setHeader("Content-Disposition", contentDisposition(normalizeUploadedFileName(book.originalFileName), book.format));
    res.send(book.buffer);
  })
);

booksRouter.get(
  "/:id/source-data",
  optionalAuth,
  requireProtectedContentAccess,
  requireDownloadAccess,
  asyncHandler(async (req, res) => {
    const book = await findBookSource(routeId(req.params.id));

    res.json({
      fileName: normalizeUploadedFileName(book.originalFileName),
      mimeType: SOURCE_CONTENT_TYPES[book.format],
      data: book.buffer.toString("base64")
    });
  })
);

/**
 * Public cover image (first page) for the landing showcase carousel (no auth).
 * Publicly cacheable since it only exposes a book's front page. Non-PDF books
 * have no page to rasterize, so they get a generated placeholder instead.
 */
booksRouter.get(
  "/:id/cover",
  asyncHandler(async (req, res) => {
    const id = requireBookId(routeId(req.params.id));

    const summary = await Book.findById(id, { title: 1, sourceFormat: 1 }).lean();
    if (!summary) {
      throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    }

    const format = ((summary.sourceFormat as SourceFormat | undefined) ?? "pdf") as SourceFormat;
    if (format !== "pdf") {
      const placeholder = await renderPlaceholderCover(summary.title ?? "?", format);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(placeholder);
      return;
    }

    const book = await findBookPdf(id);
    const renderer = await new PdfJsRenderer().open(book.buffer);

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
    requireBookId(req.params.id);

    const update: { category?: string; categories?: string[]; author?: string; featured?: boolean; description?: string; price?: number } = {};
    if (Array.isArray(req.body?.categories)) {
      const categories: string[] = req.body.categories
        .filter((value: unknown): value is string => typeof value === "string")
        .map((value: string) => value.trim().slice(0, 80))
        .filter(Boolean);
      const uniqueCategories: string[] = Array.from(new Set(categories));
      if (uniqueCategories.length > 0) {
        const knownCount = await Category.countDocuments({ name: { $in: uniqueCategories } });
        if (knownCount !== uniqueCategories.length) {
          throw new ApiError(400, "UNKNOWN_CATEGORY", "One or more categories are not in the curated category list.");
        }
      }
      update.categories = uniqueCategories;
      update.category = update.categories[0] ?? "";
    } else if (typeof req.body?.category === "string") {
      const category = req.body.category.trim().slice(0, 80);
      if (category && !(await Category.exists({ name: category }))) {
        throw new ApiError(400, "UNKNOWN_CATEGORY", "This category is not in the curated category list.");
      }
      update.category = category;
      update.categories = category ? [category] : [];
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
      category: normalizeCategories(book.categories, book.category)[0] ?? "",
      categories: normalizeCategories(book.categories, book.category),
      author: book.author ?? "",
      featured: Boolean(book.featured),
      description: book.description ?? "",
      price: book.price ?? 0
    });
  })
);

booksRouter.post(
  "/:id/cancel",
  requireAdmin,
  asyncHandler(async (req, res) => {
    requireBookId(req.params.id);

    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, status: "processing" },
      { $set: { status: "cancelled", error: "Processing was cancelled." } },
      { new: true }
    );
    if (!book) {
      const existing = await Book.findById(req.params.id, { status: 1 });
      if (!existing) {
        throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
      }
      throw new ApiError(409, "BOOK_NOT_PROCESSING", "This book is no longer being processed.");
    }

    // Remove any partial searchable data immediately. The worker also checks
    // the status between stages and cleans up if it was already in-flight.
    await Promise.all([
      Chunk.deleteMany({ bookId: book._id }),
      BookPage.deleteMany({ bookId: book._id })
    ]);

    res.json({ cancelled: true });
  })
);

// Narrated summaries are protected by the same book access rules as reading.
// The client fetches this authenticated blob and plays it from an object URL.
booksRouter.get(
  "/:id/summary-audio",
  optionalAuth,
  requireProtectedContentAccess,
  asyncHandler(async (req, res) => {
    const id = requireBookId(routeId(req.params.id));
    const book = await Book.findById(id, { summaryAudioPath: 1, summaryAudioMimeType: 1, summaryAudioFileName: 1 }).lean();
    if (!book?.summaryAudioPath || !book.summaryAudioMimeType) {
      throw new ApiError(404, "SUMMARY_AUDIO_NOT_FOUND", "This book does not have a summary audio yet.");
    }
    let buffer: Buffer;
    try {
      buffer = await storage.get(book.summaryAudioPath);
    } catch {
      throw new ApiError(404, "FILE_NOT_AVAILABLE", "The summary audio could not be found.");
    }
    res.setHeader("Content-Type", book.summaryAudioMimeType);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Content-Disposition", contentDisposition(book.summaryAudioFileName ?? "summary-audio", "audio"));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  })
);

booksRouter.put(
  "/:id/summary-audio",
  requireAdmin,
  summaryAudioUpload.single("audio"),
  asyncHandler(async (req, res) => {
    const id = requireBookId(routeId(req.params.id));
    const file = req.file;
    if (!file) {
      throw new ApiError(400, "MISSING_AUDIO", "Please choose a summary audio file.");
    }
    const book = await Book.exists({ _id: id });
    if (!book) throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    const audio = await attachSummaryAudio(id, {
      buffer: file.buffer,
      originalFileName: normalizeUploadedFileName(file.originalname),
      mimeType: file.mimetype
    });
    res.json({ summaryAudio: audio });
  })
);

booksRouter.delete(
  "/:id/summary-audio",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = requireBookId(routeId(req.params.id));
    const removed = await removeSummaryAudio(id);
    if (!removed) throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    res.json({ removed: true });
  })
);

/** Return the Heyzine reader URL, creating it on first use for PDF books. */
booksRouter.get(
  "/:id/heyzine",
  optionalAuth,
  requireProtectedContentAccess,
  asyncHandler(async (req, res) => {
    const bookId = requireBookId(routeId(req.params.id));
    const book = await Book.findById(bookId, { title: 1, sourceFormat: 1, heyzineUrl: 1, heyzineId: 1, status: 1 }).lean();
    if (!book) throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    if (book.sourceFormat !== "pdf") throw new ApiError(400, "HEYZINE_PDF_REQUIRED", "Heyzine integration currently supports PDF books only.");
    if (book.heyzineUrl) {
      res.json({ url: book.heyzineUrl });
      return;
    }
    if (!env.HEYZINE_CLIENT_ID) {
      throw new ApiError(503, "HEYZINE_NOT_CONFIGURED", "Heyzine is not configured. Set HEYZINE_CLIENT_ID on the API server.");
    }

    const pdfUrl = `${env.PUBLIC_API_URL}/api/books/${bookId}/heyzine-source?token=${createHeyzineSourceToken(String(bookId))}`;
    const response = await fetch("https://heyzine.com/api1/rest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdf: pdfUrl,
        client_id: env.HEYZINE_CLIENT_ID,
        title: book.title,
        prev_next: true,
        show_info: false
      })
    });
    const payload = await response.json().catch(() => null) as { id?: string; url?: string; state?: string; msg?: string } | null;
    if (!response.ok || !payload?.url) {
      throw new ApiError(502, "HEYZINE_CONVERSION_FAILED", payload?.msg || "Heyzine could not convert this PDF.");
    }

    await Book.updateOne({ _id: bookId }, { $set: { heyzineId: payload.id, heyzineUrl: payload.url } });
    res.json({ url: payload.url });
  })
);

/** Short-lived public source URL used only by Heyzine during conversion. */
booksRouter.get(
  "/:id/heyzine-source",
  asyncHandler(async (req, res) => {
    const bookId = requireBookId(routeId(req.params.id));
    if (!verifyHeyzineSourceToken(bookId, typeof req.query.token === "string" ? req.query.token : "")) {
      throw new ApiError(401, "INVALID_HEYZINE_SOURCE_TOKEN", "This source URL is invalid or expired.");
    }
    const book = await findBookPdf(bookId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "no-store");
    res.send(book.buffer);
  })
);

booksRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    requireBookId(req.params.id);

    const book = await Book.findById(req.params.id);
    if (!book) {
      throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
    }

    await Chunk.deleteMany({ bookId: book._id });
    await BookState.deleteMany({ bookId: book._id });
    await BookPage.deleteMany({ bookId: book._id });
    await deleteStoredPdf(book.originalPdfPath ?? undefined);
    if (book.summaryAudioPath) await storage.delete(book.summaryAudioPath);
    await book.deleteOne();

    res.json({ deleted: true });
  })
);

function contentDisposition(fileName: string, format: SourceFormat | string = "pdf") {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || `book.${format}`;
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function routeId(value: unknown) {
  return typeof value === "string" ? value : "";
}

function heyzineSigningSecret() {
  return env.HEYZINE_API_KEY || env.AUTH_JWT_SECRET;
}

function createHeyzineSourceToken(bookId: string) {
  const payload = `${bookId}.${Math.floor(Date.now() / 1000) + 10 * 60}`;
  const signature = createHmac("sha256", heyzineSigningSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

function verifyHeyzineSourceToken(bookId: string, token: string) {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return false;
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const [tokenBookId, expiresAt] = payload.split(".");
    const expected = createHmac("sha256", heyzineSigningSecret()).update(payload).digest("base64url");
    return tokenBookId === bookId && Number(expiresAt) >= Math.floor(Date.now() / 1000) &&
      signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function loadBookSourceBuffer(book: { originalPdfPath?: string | null; originalFileName: string }) {
  if (!book.originalPdfPath) {
    throw new ApiError(404, "FILE_NOT_AVAILABLE", "The original file is not available for this book.");
  }

  // Load via the storage provider. Tolerate a legacy absolute/relative path that
  // no longer resolves by retrying with a "pdfs/<basename>" key.
  const key = book.originalPdfPath;
  try {
    return await storage.get(key);
  } catch {
    const fallbackKey = `pdfs/${key.split(/[/\\]/).pop()}`;
    try {
      return await storage.get(fallbackKey);
    } catch {
      throw new ApiError(404, "FILE_NOT_AVAILABLE", "The original file could not be found.");
    }
  }
}

/** PDF-only lookup used by `/pdf`, `/pdf-data`, `/pages/:page/image`. */
async function findBookPdf(id: string) {
  requireBookId(id);

  const book = await Book.findById(id, { originalPdfPath: 1, originalFileName: 1, sourceFormat: 1 }).lean();
  if (!book) {
    throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
  }

  const format = ((book.sourceFormat as SourceFormat | undefined) ?? "pdf") as SourceFormat;
  if (format !== "pdf") {
    throw new ApiError(400, "NOT_A_PDF", "This book's original file is not a PDF.");
  }

  const buffer = await loadBookSourceBuffer(book);

  return {
    buffer,
    originalFileName: book.originalFileName
  };
}

/** Format-agnostic lookup used by `/source`, `/source-data`. */
async function findBookSource(id: string) {
  requireBookId(id);

  const book = await Book.findById(id, { originalPdfPath: 1, originalFileName: 1, sourceFormat: 1 }).lean();
  if (!book) {
    throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
  }

  const format = ((book.sourceFormat as SourceFormat | undefined) ?? "pdf") as SourceFormat;
  const buffer = await loadBookSourceBuffer(book);

  return {
    buffer,
    originalFileName: book.originalFileName,
    format
  };
}

function normalizeCategories(categories: unknown, legacyCategory: unknown): string[] {
  const current = Array.isArray(categories) ? categories.filter((value): value is string => typeof value === "string") : [];
  const cleaned = current.map((value) => value.trim()).filter(Boolean);
  if (cleaned.length) {
    return Array.from(new Set(cleaned));
  }
  if (typeof legacyCategory === "string" && legacyCategory.trim()) {
    return [legacyCategory.trim()];
  }
  return [];
}

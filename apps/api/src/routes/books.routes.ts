import { Router, type Router as ExpressRouter } from "express";
import { isValidObjectId } from "mongoose";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import { Book } from "../models/book.model.js";
import { Chunk } from "../models/chunk.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { normalizeUploadedFileName, titleFromFileName } from "../utils/file-name.js";
import { excerpt } from "../utils/text.js";

export const booksRouter: ExpressRouter = Router();

booksRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const books = await Book.find({}, { title: 1, originalFileName: 1, createdAt: 1, chunkCount: 1, pageCount: 1 })
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
      books: books.map((book) => ({
        id: String(book._id),
        title: titleFromFileName(book.title),
        originalFileName: normalizeUploadedFileName(book.originalFileName),
        createdAt: book.createdAt,
        chunkCount: book.chunkCount,
        pageCount: book.pageCount,
        author: "Unknown author",
        firstPageText: firstPageByBookId.get(String(book._id)) ?? ""
      }))
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
    await book.deleteOne();

    res.json({ deleted: true });
  })
);

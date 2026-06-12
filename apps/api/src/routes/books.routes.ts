import { Router, type Router as ExpressRouter } from "express";
import { isValidObjectId } from "mongoose";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { Book } from "../models/book.model.js";
import { Chunk } from "../models/chunk.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

export const booksRouter: ExpressRouter = Router();

booksRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const books = await Book.find({}, { title: 1, originalFileName: 1, createdAt: 1, chunkCount: 1, pageCount: 1 })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      books: books.map((book) => ({
        id: String(book._id),
        title: book.title,
        originalFileName: book.originalFileName,
        createdAt: book.createdAt,
        chunkCount: book.chunkCount,
        pageCount: book.pageCount
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

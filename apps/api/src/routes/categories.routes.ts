import { Router, type Router as ExpressRouter } from "express";
import { requirePermission, requireAuth } from "../middleware/auth.middleware.js";
import { Category } from "../models/category.model.js";
import { suggestBookCategories, type CategorizationItem } from "../services/generation/categorization.service.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

export const categoriesRouter: ExpressRouter = Router();

/** The curated category list (any signed-in user can read it). */
categoriesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const categories = await Category.find({}, { name: 1 }).sort({ name: 1 }).lean();
    res.json({ categories: categories.map((category) => category.name) });
  })
);

/** Add a category to the list (admin only). Idempotent on the name. */
categoriesRouter.post(
  "/",
  requirePermission("books"),
  asyncHandler(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";
    if (!name) {
      throw new ApiError(400, "INVALID_CATEGORY", "Please provide a category name.");
    }
    await Category.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true });
    const categories = await Category.find({}, { name: 1 }).sort({ name: 1 }).lean();
    res.status(201).json({ categories: categories.map((category) => category.name) });
  })
);

/**
 * Ask the AI to pick a category for each supplied book (admin only).
 *
 * Used by the Excel import panel before the books are created, so the payload is
 * metadata the admin is looking at rather than stored documents. A category the
 * model invents is added to the curated list and the admins are notified, which
 * is why the response also returns the refreshed list.
 */
categoriesRouter.post(
  "/suggest",
  requirePermission("books"),
  asyncHandler(async (req, res) => {
    const rawBooks = Array.isArray(req.body?.books) ? req.body.books : [];
    if (!rawBooks.length) {
      throw new ApiError(400, "NO_BOOKS", "Select at least one book to categorise.");
    }
    if (rawBooks.length > 100) {
      throw new ApiError(400, "TOO_MANY_BOOKS", "Categorise at most 100 books at a time.");
    }

    const books: CategorizationItem[] = [];
    for (const entry of rawBooks) {
      const ref = typeof entry?.ref === "string" ? entry.ref.trim() : String(entry?.ref ?? "").trim();
      const title = typeof entry?.title === "string" ? entry.title.trim() : "";
      if (!ref || !title) continue;
      books.push({
        ref,
        title: title.slice(0, 300),
        author: typeof entry?.author === "string" ? entry.author.trim().slice(0, 120) : undefined,
        description: typeof entry?.description === "string" ? entry.description.trim() : undefined
      });
    }

    if (!books.length) {
      throw new ApiError(400, "NO_BOOKS", "None of the selected books had a title to categorise.");
    }

    const suggestions = await suggestBookCategories(books);
    const categories = await Category.find({}, { name: 1 }).sort({ name: 1 }).lean();
    res.json({ suggestions, categories: categories.map((category) => category.name) });
  })
);

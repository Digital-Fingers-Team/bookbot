import { Router, type Router as ExpressRouter } from "express";
import { isValidObjectId } from "mongoose";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { Book } from "../models/book.model.js";
import { Category } from "../models/category.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { readableBookTitle } from "../utils/file-name.js";

export const adminUsersRouter: ExpressRouter = Router();

adminUsersRouter.use(requireAdmin);

/** List users with their granted access (categories + book titles). */
adminUsersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const filter = search
      ? { $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
      : {};

    const users = await User.find(filter, { name: 1, email: 1, role: 1, allowedBookIds: 1, allowedCategories: 1 })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // Resolve titles for every granted book in one query.
    const allBookIds = [...new Set(users.flatMap((u) => (u.allowedBookIds ?? []).map((id) => String(id))))];
    const books = allBookIds.length
      ? await Book.find({ _id: { $in: allBookIds } }, { title: 1, originalFileName: 1 }).lean()
      : [];
    const titleById = new Map(
      books.map((b) => [
        String(b._id),
        readableBookTitle({ title: b.title, originalFileName: b.originalFileName, firstPageText: "" })
      ])
    );

    res.json({
      users: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        allowedCategories: u.allowedCategories ?? [],
        allowedBooks: (u.allowedBookIds ?? [])
          .map((id) => ({ id: String(id), title: titleById.get(String(id)) ?? "—" }))
      }))
    });
  })
);

/** Grant a book or category to a user directly (no payment request). */
adminUsersRouter.post(
  "/:id/grant",
  asyncHandler(async (req, res) => {
    const { targetType, targetValue } = await parseTarget(req.body);
    const userId = requireUserId(req.params.id);
    const field = targetType === "book" ? "allowedBookIds" : "allowedCategories";
    const result = await User.updateOne({ _id: userId }, { $addToSet: { [field]: targetValue } });
    if (!result.matchedCount) {
      throw new ApiError(404, "USER_NOT_FOUND", "This user was not found.");
    }
    res.json({ ok: true });
  })
);

/** Revoke a previously granted book or category. */
adminUsersRouter.post(
  "/:id/revoke",
  asyncHandler(async (req, res) => {
    const { targetType, targetValue } = await parseTarget(req.body, { validate: false });
    const userId = requireUserId(req.params.id);
    const field = targetType === "book" ? "allowedBookIds" : "allowedCategories";
    const result = await User.updateOne({ _id: userId }, { $pull: { [field]: targetValue } });
    if (!result.matchedCount) {
      throw new ApiError(404, "USER_NOT_FOUND", "This user was not found.");
    }
    res.json({ ok: true });
  })
);

function requireUserId(value: unknown): string {
  if (typeof value !== "string" || !isValidObjectId(value)) {
    throw new ApiError(400, "INVALID_USER_ID", "The user id is invalid.");
  }
  return value;
}

async function parseTarget(body: unknown, options: { validate?: boolean } = {}) {
  const raw = body as { targetType?: unknown; targetValue?: unknown };
  const targetType = raw.targetType === "category" ? "category" : raw.targetType === "book" ? "book" : "";
  const targetValue = typeof raw.targetValue === "string" ? raw.targetValue.trim() : "";
  if (!targetType || !targetValue) {
    throw new ApiError(400, "INVALID_TARGET", "Please provide a book or category.");
  }

  if (options.validate !== false) {
    if (targetType === "book") {
      if (!isValidObjectId(targetValue) || !(await Book.exists({ _id: targetValue }))) {
        throw new ApiError(404, "BOOK_NOT_FOUND", "This book was not found.");
      }
    } else if (!(await Category.exists({ name: targetValue }))) {
      throw new ApiError(404, "CATEGORY_NOT_FOUND", "This category was not found.");
    }
  }

  return { targetType, targetValue };
}

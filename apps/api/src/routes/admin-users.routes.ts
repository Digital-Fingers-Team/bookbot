import { Router, type Router as ExpressRouter } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { Book } from "../models/book.model.js";
import { Category } from "../models/category.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { readableBookTitle } from "../utils/file-name.js";
import { cursorFilter, nextCursor, parsePageParams } from "../utils/pagination.js";

const targetSchema = z.object({
  targetType: z.enum(["book", "category"]),
  targetValue: z.string().trim().min(1).max(200)
});

const bookIdSchema = z.object({
  bookId: z.string().trim().min(1)
});

export const adminUsersRouter: ExpressRouter = Router();

adminUsersRouter.use(requireAdmin);

/** List users with their granted access (categories + book titles). */
adminUsersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const searchFilter = search
      ? { $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
      : {};

    // Combine the search $or and the cursor $or under $and so neither clobbers
    // the other at the top level.
    const { limit, cursor } = parsePageParams(req.query, 50, 100);
    const clauses = [searchFilter, cursorFilter(cursor)].filter((clause) => Object.keys(clause).length);
    const filter = clauses.length ? { $and: clauses } : {};

    const users = await User.find(
      filter,
      { name: 1, email: 1, role: 1, allowedBookIds: 1, allowedCategories: 1, allowedDownloadBookIds: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
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
      nextCursor: nextCursor(users, limit),
      users: users.map((u) => {
        const downloadSet = new Set((u.allowedDownloadBookIds ?? []).map((id) => String(id)));
        return {
          id: String(u._id),
          name: u.name,
          email: u.email,
          role: u.role,
          allowedCategories: u.allowedCategories ?? [],
          allowedBooks: (u.allowedBookIds ?? []).map((id) => ({
            id: String(id),
            title: titleById.get(String(id)) ?? "—",
            canDownload: downloadSet.has(String(id))
          }))
        };
      })
    });
  })
);

/** Grant a book or category to a user directly (no payment request). */
adminUsersRouter.post(
  "/:id/grant",
  validate({ body: targetSchema }),
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
  validate({ body: targetSchema }),
  asyncHandler(async (req, res) => {
    const { targetType, targetValue } = await parseTarget(req.body, { validate: false });
    const userId = requireUserId(req.params.id);
    const field = targetType === "book" ? "allowedBookIds" : "allowedCategories";
    // Revoking a book's view access also revokes its download grant — a stale
    // download grant for a book the user can no longer see is just clutter.
    const update =
      targetType === "book"
        ? { $pull: { allowedBookIds: targetValue, allowedDownloadBookIds: targetValue } }
        : { $pull: { [field]: targetValue } };
    const result = await User.updateOne({ _id: userId }, update);
    if (!result.matchedCount) {
      throw new ApiError(404, "USER_NOT_FOUND", "This user was not found.");
    }
    res.json({ ok: true });
  })
);

/** Grant download rights for a book the user already has view access to. */
adminUsersRouter.post(
  "/:id/download-grant",
  validate({ body: bookIdSchema }),
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req.params.id);
    const bookId = requireBookId(req.body.bookId);

    const user = await User.findById(userId, { allowedBookIds: 1 });
    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "This user was not found.");
    }
    if (!(user.allowedBookIds ?? []).some((id) => String(id) === bookId)) {
      throw new ApiError(400, "BOOK_ACCESS_REQUIRED", "Grant this user view access to the book before enabling downloads.");
    }

    await User.updateOne({ _id: userId }, { $addToSet: { allowedDownloadBookIds: bookId } });
    res.json({ ok: true });
  })
);

/** Revoke download rights for a book (view access is untouched). */
adminUsersRouter.post(
  "/:id/download-revoke",
  validate({ body: bookIdSchema }),
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req.params.id);
    const bookId = requireBookId(req.body.bookId);
    const result = await User.updateOne({ _id: userId }, { $pull: { allowedDownloadBookIds: bookId } });
    if (!result.matchedCount) {
      throw new ApiError(404, "USER_NOT_FOUND", "This user was not found.");
    }
    res.json({ ok: true });
  })
);

function requireBookId(value: unknown): string {
  if (typeof value !== "string" || !isValidObjectId(value)) {
    throw new ApiError(400, "INVALID_BOOK_ID", "The book id is invalid.");
  }
  return value;
}

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

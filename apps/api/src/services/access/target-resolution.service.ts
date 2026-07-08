import { isValidObjectId } from "mongoose";
import { Book } from "../../models/book.model.js";
import { Category } from "../../models/category.model.js";
import { ApiError } from "../../utils/api-error.js";

export type GrantTarget = { targetType: "book" | "category"; targetValue: string };

/**
 * Parses and validates a `{ targetType, targetValue }` grant/revoke body,
 * shared by the platform-admin, org-admin, and org-catalog grant routes.
 * Existence is checked against Book/Category unless `validate: false` — used
 * on revoke, where a since-deleted target should still be removable.
 */
export async function resolveGrantTarget(
  body: unknown,
  options: { validate?: boolean } = {}
): Promise<GrantTarget> {
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

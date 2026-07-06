import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { canAccessBook, canDownloadBook, resolveAccessScope } from "../services/access/access.service.js";

/**
 * Gate a `/:id` book route: a regular user may only proceed if an admin has
 * granted them the book (directly or via its category). Admins always pass.
 * Must run after `requireAuth`.
 */
export const requireBookAccess = asyncHandler(async (req, _res, next) => {
  const bookId = typeof req.params.id === "string" ? req.params.id : "";
  const scope = await resolveAccessScope(req.user!);
  if (!canAccessBook(scope, bookId)) {
    throw new ApiError(403, "BOOK_ACCESS_DENIED", "You don't have access to this book yet.");
  }
  next();
});

/**
 * Gate a `/:id` book route that serves the raw file: a regular user may only
 * proceed if an admin has separately granted them download rights for this
 * specific book. Admins always pass. Run after `requireAuth` + `requireBookAccess`.
 */
export const requireDownloadAccess = asyncHandler(async (req, _res, next) => {
  const bookId = typeof req.params.id === "string" ? req.params.id : "";
  if (!(await canDownloadBook(req.user!, bookId))) {
    throw new ApiError(403, "DOWNLOAD_ACCESS_DENIED", "You don't have permission to download this book.");
  }
  next();
});

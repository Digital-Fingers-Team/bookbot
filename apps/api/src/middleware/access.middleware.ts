import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { canAccessBook, canDownloadBook, resolveAccessScope } from "../services/access/access.service.js";
import { resolveClientIp, resolveNetworkBookAccess } from "../services/access/network-policy.service.js";

/**
 * Gate a `/:id` book route: a regular user may only proceed if an admin has
 * granted them the book (directly, via its category, or because it's free —
 * `resolveAccessScope` already folds free/ready books into the scope).
 * Admins always pass. Must run after `requireAuth`.
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
 * Gate protected content for both authenticated users and anonymous network
 * readers. Existing user grants remain authoritative for signed-in users;
 * network access is an additional path, never a replacement for them.
 */
export const requireProtectedContentAccess = asyncHandler(async (req, _res, next) => {
  const bookId = typeof req.params.id === "string" ? req.params.id : typeof req.body?.bookId === "string" ? req.body.bookId : "";

  if (req.user?.role === "admin") {
    next();
    return;
  }

  if (req.user) {
    const scope = await resolveAccessScope(req.user);
    if (bookId && canAccessBook(scope, bookId)) {
      next();
      return;
    }
  }

  if (!bookId) {
    throw new ApiError(403, "ORG_NETWORK_ACCESS_DENIED", "This content is only available from an authorized organization network.");
  }

  const access = await resolveNetworkBookAccess(bookId, resolveClientIp(req));
  if (!access.allowed) {
    throw new ApiError(403, "ORG_NETWORK_ACCESS_DENIED", "This content is only available from an authorized organization network.");
  }
  req.networkBookAccess = access;
  next();
});

/**
 * Gate a `/:id` book route that serves the raw file: a regular user may only
 * proceed if an admin has separately granted them download rights for this
 * specific book. Admins always pass. Run after `requireAuth` + `requireBookAccess`.
 */
export const requireDownloadAccess = asyncHandler(async (req, _res, next) => {
  const bookId = typeof req.params.id === "string" ? req.params.id : "";
  const personalDownload = req.user ? await canDownloadBook(req.user, bookId) : false;
  const networkDownload = req.networkBookAccess?.downloadable ??
    (await resolveNetworkBookAccess(bookId, resolveClientIp(req))).downloadable;
  if (!personalDownload && !networkDownload) {
    throw new ApiError(403, "DOWNLOAD_ACCESS_DENIED", "You don't have permission to download this book.");
  }
  next();
});

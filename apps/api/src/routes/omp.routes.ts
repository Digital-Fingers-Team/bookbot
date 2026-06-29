import { Router, type Router as ExpressRouter } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { checkOmpHealth, fetchOmpCatalog } from "../services/omp/omp.client.js";
import { activateAuthorAccount, buildOmpLoginUrl, getAuthorLink } from "../services/omp/omp-author.service.js";

export const ompRouter: ExpressRouter = Router();

function requireUserId(req: { user?: { id: string } }): string {
  const id = req.user?.id;
  if (!id) {
    throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
  }
  return id;
}

/** Liveness of the linked OMP install (proves the aradobot ↔ OMP channel). */
ompRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const health = await checkOmpHealth();
    res.status(health.reachable ? 200 : 502).json(health);
  })
);

/** Published monographs pulled live from OMP's catalog API. */
ompRouter.get(
  "/catalog",
  asyncHandler(async (req, res) => {
    const rawCount = Number(req.query.count);
    const count = Number.isFinite(rawCount) && rawCount > 0 ? Math.min(rawCount, 100) : undefined;
    const result = await fetchOmpCatalog({ count });
    res.json(result);
  })
);

/** Current user's OMP author-account link status. */
ompRouter.get(
  "/author-account",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getAuthorLink(requireUserId(req)));
  })
);

/** Activate (create if needed) an OMP author account for the current user. */
ompRouter.post(
  "/author-account",
  requireAuth,
  asyncHandler(async (req, res) => {
    const link = await activateAuthorAccount(requireUserId(req));
    res.status(link.linkedAt ? 201 : 200).json(link);
  })
);

/** Build a one-time auto-login URL into OMP for the current user. */
ompRouter.post(
  "/login-link",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ url: await buildOmpLoginUrl(requireUserId(req)) });
  })
);

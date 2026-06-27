import { Router, type Router as ExpressRouter } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { checkOmpHealth, fetchOmpCatalog } from "../services/omp/omp.client.js";

export const ompRouter: ExpressRouter = Router();

/** Liveness of the linked OMP install (proves the bookbot ↔ OMP channel). */
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

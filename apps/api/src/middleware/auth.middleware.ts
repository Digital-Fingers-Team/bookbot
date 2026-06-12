import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!env.ADMIN_API_KEY) {
    next();
    return;
  }

  const providedKey = req.header("x-admin-key");
  if (providedKey !== env.ADMIN_API_KEY) {
    next(new ApiError(401, "UNAUTHORIZED", "Admin access is required for this action."));
    return;
  }

  next();
}

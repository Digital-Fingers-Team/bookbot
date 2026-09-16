import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { getUserFromToken } from "../services/auth/auth.service.js";
import { ApiError } from "../utils/api-error.js";
import type { AdminPermission } from "../models/user.model.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (!token) {
      throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    }

    req.user = await getUserFromToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

/** Authenticate when a bearer token is present, but allow anonymous requests. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (token) {
      req.user = await getUserFromToken(token);
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (env.ADMIN_API_KEY && req.header("x-admin-key") === env.ADMIN_API_KEY) {
      next();
      return;
    }

    const token = bearerToken(req);
    if (!token) {
      throw new ApiError(401, "UNAUTHORIZED", "Admin access is required for this action.");
    }

    const user = await getUserFromToken(token);
    req.user = user;

    if (user.role !== "admin") {
      throw new ApiError(403, "FORBIDDEN", "Only admins can perform this action.");
    }

    next();
    return;
  } catch (error) {
    next(error);
  }
}

/**
 * Gate a route on one admin permission. Same shape as requireAdmin — including
 * the ADMIN_API_KEY bypass for machine callers — but an admin whose account was
 * not granted this permission is refused rather than let through.
 */
export function requirePermission(permission: AdminPermission) {
  return async function guard(req: Request, _res: Response, next: NextFunction) {
    try {
      if (env.ADMIN_API_KEY && req.header("x-admin-key") === env.ADMIN_API_KEY) {
        next();
        return;
      }

      const token = bearerToken(req);
      if (!token) {
        throw new ApiError(401, "UNAUTHORIZED", "Admin access is required for this action.");
      }

      const user = await getUserFromToken(token);
      req.user = user;

      if (user.role !== "admin") {
        throw new ApiError(403, "FORBIDDEN", "Only admins can perform this action.");
      }
      if (!user.adminPermissions.includes(permission)) {
        throw new ApiError(403, "MISSING_PERMISSION", "Your admin account does not have access to this tool.");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function requireOrgAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (!token) {
      throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    }

    const user = await getUserFromToken(token);
    req.user = user;

    if (user.role !== "org_admin" && user.role !== "admin") {
      throw new ApiError(403, "FORBIDDEN", "Only organization admins can perform this action.");
    }

    next();
  } catch (error) {
    next(error);
  }
}

function bearerToken(req: Request) {
  const header = req.header("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return header.slice("bearer ".length).trim();
}

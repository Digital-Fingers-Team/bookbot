import { Router, type Router as ExpressRouter } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import { Category } from "../models/category.model.js";
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
  requireAdmin,
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

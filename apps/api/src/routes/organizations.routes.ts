import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { Book } from "../models/book.model.js";
import { Organization } from "../models/organization.model.js";
import { User } from "../models/user.model.js";
import { resolveGrantTarget } from "../services/access/target-resolution.service.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { readableBookTitle } from "../utils/file-name.js";
import { requireOrgId, requireUserId } from "../utils/object-id.js";

const createSchema = z.object({ name: z.string().trim().min(2).max(200) });
const targetSchema = z.object({
  targetType: z.enum(["book", "category"]),
  targetValue: z.string().trim().min(1).max(200)
});
const assignAdminSchema = z.object({ userId: z.string().trim().min(1) });

export const organizationsRouter: ExpressRouter = Router();

organizationsRouter.use(requireAdmin);

/** List organizations with their subscribed catalog (book titles + categories) and member counts. */
organizationsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const orgs = await Organization.find({}).sort({ createdAt: -1 }).lean();

    const allBookIds = [...new Set(orgs.flatMap((o) => (o.allowedBookIds ?? []).map((id) => String(id))))];
    const books = allBookIds.length
      ? await Book.find({ _id: { $in: allBookIds } }, { title: 1, originalFileName: 1 }).lean()
      : [];
    const titleById = new Map(
      books.map((b) => [
        String(b._id),
        readableBookTitle({ title: b.title, originalFileName: b.originalFileName, firstPageText: "" })
      ])
    );

    const counts = await User.aggregate([
      { $match: { organizationId: { $in: orgs.map((o) => o._id) } } },
      { $group: { _id: { org: "$organizationId", role: "$role" }, count: { $sum: 1 } } }
    ]);
    const studentCounts = new Map<string, number>();
    const adminCounts = new Map<string, number>();
    for (const row of counts) {
      const key = String(row._id.org);
      if (row._id.role === "org_admin") adminCounts.set(key, row.count);
      else studentCounts.set(key, (studentCounts.get(key) ?? 0) + row.count);
    }

    res.json({
      organizations: orgs.map((o) => ({
        id: String(o._id),
        name: o.name,
        allowedCategories: o.allowedCategories ?? [],
        allowedBooks: (o.allowedBookIds ?? []).map((id) => ({
          id: String(id),
          title: titleById.get(String(id)) ?? "—"
        })),
        studentCount: studentCounts.get(String(o._id)) ?? 0,
        adminCount: adminCounts.get(String(o._id)) ?? 0,
        createdAt: o.createdAt
      }))
    });
  })
);

/** Create a new organization (university). */
organizationsRouter.post(
  "/",
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const created = await Organization.create({ name: req.body.name });
    res.status(201).json({ id: String(created._id), name: created.name });
  })
);

/** Subscribe the organization to a book or category. */
organizationsRouter.post(
  "/:id/grant",
  validate({ body: targetSchema }),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req.params.id);
    const { targetType, targetValue } = await resolveGrantTarget(req.body);
    const field = targetType === "book" ? "allowedBookIds" : "allowedCategories";
    const result = await Organization.updateOne({ _id: orgId }, { $addToSet: { [field]: targetValue } });
    if (!result.matchedCount) {
      throw new ApiError(404, "ORG_NOT_FOUND", "This organization was not found.");
    }
    res.json({ ok: true });
  })
);

/** Unsubscribe the organization from a book or category. */
organizationsRouter.post(
  "/:id/revoke",
  validate({ body: targetSchema }),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req.params.id);
    const { targetType, targetValue } = await resolveGrantTarget(req.body, { validate: false });
    const field = targetType === "book" ? "allowedBookIds" : "allowedCategories";
    const result = await Organization.updateOne({ _id: orgId }, { $pull: { [field]: targetValue } });
    if (!result.matchedCount) {
      throw new ApiError(404, "ORG_NOT_FOUND", "This organization was not found.");
    }
    res.json({ ok: true });
  })
);

/** Make an existing user this organization's admin (they manage their org's students from there on). */
organizationsRouter.post(
  "/:id/assign-admin",
  validate({ body: assignAdminSchema }),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req.params.id);
    if (!(await Organization.exists({ _id: orgId }))) {
      throw new ApiError(404, "ORG_NOT_FOUND", "This organization was not found.");
    }
    const userId = requireUserId(req.body.userId);
    const result = await User.updateOne(
      { _id: userId, role: { $ne: "admin" } },
      { $set: { role: "org_admin", organizationId: orgId } }
    );
    if (!result.matchedCount) {
      throw new ApiError(404, "USER_NOT_FOUND", "This user was not found (or is a platform admin).");
    }
    res.json({ ok: true });
  })
);

/** Delete an organization. Members are unlinked (org_admins fall back to plain users); their individually granted books/categories are untouched. */
organizationsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req.params.id);
    const deleted = await Organization.findByIdAndDelete(orgId);
    if (!deleted) {
      throw new ApiError(404, "ORG_NOT_FOUND", "This organization was not found.");
    }

    // Only org_admin/user roles ever carry an organizationId (assign-admin
    // excludes platform admins), so it's always safe to reset role to "user".
    await User.updateMany({ organizationId: orgId }, { $unset: { organizationId: "" }, $set: { role: "user" } });

    res.json({ ok: true });
  })
);

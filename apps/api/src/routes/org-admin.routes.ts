import { Router, type Router as ExpressRouter, type Request } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireOrgAdmin } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { Book } from "../models/book.model.js";
import { Organization } from "../models/organization.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { readableBookTitle } from "../utils/file-name.js";
import { requireBookId, requireUserId } from "../utils/object-id.js";
import { cursorFilter, nextCursor, parsePageParams } from "../utils/pagination.js";
import { escapeRegExp } from "../utils/text.js";
import { networkPolicyResponse, resolveClientIp, saveNetworkPolicy, testNetworkPolicy } from "../services/access/network-policy.service.js";

const targetSchema = z.object({
  targetType: z.enum(["book", "category"]),
  targetValue: z.string().trim().min(1).max(200)
});
const grantSchema = z.object({
  targetType: z.literal("book"),
  targetValue: z.string().trim().min(1).max(200)
});
const bookIdSchema = z.object({ bookId: z.string().trim().min(1) });
const addStudentSchema = z.object({ email: z.string().trim().email() });
const networkPolicySchema = z.object({
  networkRestrictionEnabled: z.boolean(),
  allowedIpCidrs: z.array(z.string().trim().min(1).max(200)).max(100),
  downloadableBookIds: z.array(z.string().trim().min(1)).max(1000).optional()
});
const networkTestSchema = z.object({ ip: z.string().trim().min(1).max(200).optional() });

/** How many students in this org already have a given book granted. */
async function countStudentsWithBook(orgId: string, bookId: string): Promise<number> {
  return User.countDocuments({ organizationId: orgId, role: "user", allowedBookIds: bookId });
}

/** How many students in this org have been granted each book, keyed by book id. */
async function countGrantedPerBook(orgId: string): Promise<Map<string, number>> {
  const rows = await User.aggregate<{ _id: unknown; count: number }>([
    { $match: { organizationId: new Types.ObjectId(orgId), role: "user" } },
    { $unwind: "$allowedBookIds" },
    { $group: { _id: "$allowedBookIds", count: { $sum: 1 } } }
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export const orgAdminRouter: ExpressRouter = Router();

orgAdminRouter.use(requireOrgAdmin);

/** The signed-in org admin's organization: name + subscribed catalog. */
orgAdminRouter.get(
  "/organization",
  asyncHandler(async (req, res) => {
    const org = await Organization.findById(requireMyOrgId(req)).lean();
    if (!org) {
      throw new ApiError(404, "ORG_NOT_FOUND", "Your organization was not found.");
    }

    const books = org.allowedBookIds?.length
      ? await Book.find({ _id: { $in: org.allowedBookIds } }, { title: 1, originalFileName: 1, price: 1 }).lean()
      : [];
    const grantedPerBook = await countGrantedPerBook(String(org._id));
    const quotas = (org.bookQuotas ?? {}) as Record<string, number>;

    res.json({
      id: String(org._id),
      name: org.name,
      allowedCategories: org.allowedCategories ?? [],
      allowedBooks: books.map((b) => ({
        id: String(b._id),
        title: readableBookTitle({ title: b.title, originalFileName: b.originalFileName, firstPageText: "" }),
        price: b.price ?? 0,
        quota: quotas[String(b._id)] ?? null,
        granted: grantedPerBook.get(String(b._id)) ?? 0
      }))
    });
  })
);

orgAdminRouter.get(
  "/network-policy",
  asyncHandler(async (req, res) => {
    const organization = await Organization.findById(requireMyOrgId(req)).lean();
    if (!organization) throw new ApiError(404, "ORG_NOT_FOUND", "Your organization was not found.");
    res.json(networkPolicyResponse(organization));
  })
);

orgAdminRouter.put(
  "/network-policy",
  validate({ body: networkPolicySchema }),
  asyncHandler(async (req, res) => {
    res.json({ networkPolicy: await saveNetworkPolicy(requireMyOrgId(req), req.body, req.user!.id) });
  })
);

orgAdminRouter.post(
  "/network-policy/test",
  validate({ body: networkTestSchema }),
  asyncHandler(async (req, res) => {
    res.json(await testNetworkPolicy(requireMyOrgId(req), req.body.ip ?? resolveClientIp(req)));
  })
);

orgAdminRouter.get(
  "/network-policy/current-ip",
  asyncHandler(async (req, res) => {
    const orgId = requireMyOrgId(req);
    const ip = resolveClientIp(req);
    const updated = await Organization.findByIdAndUpdate(orgId, { $set: { lastObservedIp: ip } }, { new: true }).lean();
    if (!updated) throw new ApiError(404, "ORG_NOT_FOUND", "Your organization was not found.");
    res.json({ ip, networkPolicy: networkPolicyResponse(updated) });
  })
);

/** List students in the org admin's own organization, with their granted access. */
orgAdminRouter.get(
  "/students",
  asyncHandler(async (req, res) => {
    const orgId = requireMyOrgId(req);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const searchFilter = search
      ? {
          $or: [
            { name: { $regex: escapeRegExp(search), $options: "i" } },
            { email: { $regex: escapeRegExp(search), $options: "i" } }
          ]
        }
      : {};

    const { limit, cursor } = parsePageParams(req.query, 50, 100);
    const clauses = [{ organizationId: orgId, role: "user" }, searchFilter, cursorFilter(cursor)].filter(
      (clause) => Object.keys(clause).length
    );

    const students = await User.find(
      { $and: clauses },
      { name: 1, email: 1, allowedBookIds: 1, allowedCategories: 1, allowedDownloadBookIds: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    const allBookIds = [...new Set(students.flatMap((u) => (u.allowedBookIds ?? []).map((id) => String(id))))];
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
      nextCursor: nextCursor(students, limit),
      students: students.map((u) => {
        const downloadSet = new Set((u.allowedDownloadBookIds ?? []).map((id) => String(id)));
        return {
          id: String(u._id),
          name: u.name,
          email: u.email,
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

/** Add an existing (already-registered) user to the org by email. */
orgAdminRouter.post(
  "/students",
  validate({ body: addStudentSchema }),
  asyncHandler(async (req, res) => {
    const orgId = requireMyOrgId(req);
    const email = (req.body.email as string).toLowerCase();
    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "No account with this email exists yet — ask them to register first.");
    }
    if (user.role !== "user") {
      throw new ApiError(400, "NOT_A_STUDENT", "This account can't be added as a student.");
    }
    if (user.organizationId) {
      throw new ApiError(409, "ALREADY_IN_ORG", "This user already belongs to an organization.");
    }

    user.organizationId = orgId as never;
    await user.save();
    res.status(201).json({ id: String(user._id), name: user.name, email: user.email });
  })
);

/** Remove a student from the org (their individually granted books/categories are untouched). */
orgAdminRouter.post(
  "/students/:id/remove",
  asyncHandler(async (req, res) => {
    const orgId = requireMyOrgId(req);
    const userId = requireUserId(req.params.id);
    const result = await User.updateOne(
      { _id: userId, organizationId: orgId, role: "user" },
      { $unset: { organizationId: "" } }
    );
    if (!result.matchedCount) {
      throw new ApiError(404, "STUDENT_NOT_FOUND", "This student was not found in your organization.");
    }
    res.json({ ok: true });
  })
);

/**
 * Grant a student access to a book — must already be in the org's subscribed
 * catalog, and within that book's per-title seat limit (set by the platform
 * admin for how many copies the org paid for). Categories can no longer be
 * granted to individual students, since an open-ended category can't be
 * counted against a fixed per-book quota.
 */
orgAdminRouter.post(
  "/students/:id/grant",
  validate({ body: grantSchema }),
  asyncHandler(async (req, res) => {
    const orgId = requireMyOrgId(req);
    const userId = requireUserId(req.params.id);
    const { targetValue: bookId } = req.body as { targetType: "book"; targetValue: string };

    const org = await Organization.findById(orgId, { allowedBookIds: 1, bookQuotas: 1 }).lean();
    if (!(org?.allowedBookIds ?? []).some((id) => String(id) === bookId)) {
      throw new ApiError(400, "NOT_IN_CATALOG", "Your organization hasn't subscribed to this book.");
    }

    const student = await User.findOne(
      { _id: userId, organizationId: orgId, role: "user" },
      { allowedBookIds: 1 }
    );
    if (!student) {
      throw new ApiError(404, "STUDENT_NOT_FOUND", "This student was not found in your organization.");
    }

    const alreadyGranted = (student.allowedBookIds ?? []).some((id) => String(id) === bookId);
    const quota = ((org?.bookQuotas ?? {}) as Record<string, number>)[bookId] ?? null;
    if (!alreadyGranted && quota != null) {
      const granted = await countStudentsWithBook(orgId, bookId);
      if (granted >= quota) {
        throw new ApiError(
          400,
          "QUOTA_EXCEEDED",
          "Your organization has used up its paid seats for this book — ask the platform admin to raise the limit."
        );
      }
    }

    await User.updateOne({ _id: userId }, { $addToSet: { allowedBookIds: bookId } });
    res.json({ ok: true });
  })
);

/** Revoke a previously granted book or category from a student. */
orgAdminRouter.post(
  "/students/:id/revoke",
  validate({ body: targetSchema }),
  asyncHandler(async (req, res) => {
    const orgId = requireMyOrgId(req);
    const userId = requireUserId(req.params.id);
    const { targetType, targetValue } = req.body as { targetType: "book" | "category"; targetValue: string };
    const update =
      targetType === "book"
        ? { $pull: { allowedBookIds: targetValue, allowedDownloadBookIds: targetValue } }
        : { $pull: { allowedCategories: targetValue } };
    const result = await User.updateOne({ _id: userId, organizationId: orgId, role: "user" }, update);
    if (!result.matchedCount) {
      throw new ApiError(404, "STUDENT_NOT_FOUND", "This student was not found in your organization.");
    }
    res.json({ ok: true });
  })
);

/** Grant download rights for a book the student already has view access to. */
orgAdminRouter.post(
  "/students/:id/download-grant",
  validate({ body: bookIdSchema }),
  asyncHandler(async (req, res) => {
    const orgId = requireMyOrgId(req);
    const userId = requireUserId(req.params.id);
    const bookId = requireBookId(req.body.bookId);

    const student = await User.findOne(
      { _id: userId, organizationId: orgId, role: "user" },
      { allowedBookIds: 1 }
    );
    if (!student) {
      throw new ApiError(404, "STUDENT_NOT_FOUND", "This student was not found in your organization.");
    }
    if (!(student.allowedBookIds ?? []).some((id) => String(id) === bookId)) {
      throw new ApiError(400, "BOOK_ACCESS_REQUIRED", "Grant this student view access to the book before enabling downloads.");
    }

    await User.updateOne({ _id: userId }, { $addToSet: { allowedDownloadBookIds: bookId } });
    res.json({ ok: true });
  })
);

/** Revoke download rights for a book (view access is untouched). */
orgAdminRouter.post(
  "/students/:id/download-revoke",
  validate({ body: bookIdSchema }),
  asyncHandler(async (req, res) => {
    const orgId = requireMyOrgId(req);
    const userId = requireUserId(req.params.id);
    const bookId = requireBookId(req.body.bookId);
    const result = await User.updateOne(
      { _id: userId, organizationId: orgId, role: "user" },
      { $pull: { allowedDownloadBookIds: bookId } }
    );
    if (!result.matchedCount) {
      throw new ApiError(404, "STUDENT_NOT_FOUND", "This student was not found in your organization.");
    }
    res.json({ ok: true });
  })
);

function requireMyOrgId(req: Request): string {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    throw new ApiError(403, "NO_ORGANIZATION", "Your account isn't linked to an organization.");
  }
  return orgId;
}

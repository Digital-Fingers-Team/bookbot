import bcrypt from "bcryptjs";
import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { requirePermission } from "../middleware/auth.middleware.js";
import { ADMIN_PERMISSIONS, User, normalizeAdminPermissions } from "../models/user.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUserId } from "../utils/object-id.js";

const permissionsSchema = z.array(z.enum(ADMIN_PERMISSIONS)).max(ADMIN_PERMISSIONS.length);

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  // Same floor as self-registration, so the two ways to get an account agree.
  password: z.string().min(6).max(128),
  permissions: permissionsSchema
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  permissions: permissionsSchema.optional()
});

export const adminAccountsRouter: ExpressRouter = Router();

// Managing admins is itself a permission, so an account can be given every
// other tool without being able to hand out access.
adminAccountsRouter.use(requirePermission("admins"));

// requirePermission also admits a machine holding ADMIN_API_KEY, which leaves
// no session user behind. These handlers are all written around who is acting
// — you cannot edit your own row — so require a real person rather than
// dereferencing a user that isn't there.
adminAccountsRouter.use((req, _res, next) => {
  next(req.user ? undefined : new ApiError(401, "UNAUTHORIZED", "Sign in as an admin to manage admin accounts."));
});

/** Every admin account and what each one is allowed to reach. */
adminAccountsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const admins = await User.find({ role: "admin" }, { name: 1, email: 1, adminPermissions: 1, createdAt: 1 })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    res.json({
      permissions: [...ADMIN_PERMISSIONS],
      admins: admins.map((admin) => ({
        id: String(admin._id),
        name: admin.name,
        email: admin.email,
        permissions: normalizeAdminPermissions(admin.adminPermissions),
        // The UI disables the controls for your own row rather than letting the
        // request fail: nobody edits their own access here.
        isSelf: String(admin._id) === String(req.user!.id),
        createdAt: admin.createdAt ?? null
      }))
    });
  })
);

/** Create a new admin account with exactly the tools it needs. */
adminAccountsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_ADMIN", "Please enter valid account details.", parsed.error.flatten());
    }

    const email = parsed.data.email.toLowerCase();
    if (await User.exists({ email })) {
      throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
    }

    const created = await User.create({
      name: parsed.data.name,
      email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      role: "admin",
      adminPermissions: normalizeAdminPermissions(parsed.data.permissions)
    });

    res.status(201).json({
      admin: {
        id: String(created._id),
        name: created.name,
        email: created.email,
        permissions: normalizeAdminPermissions(created.adminPermissions),
        isSelf: false,
        createdAt: created.createdAt ?? null
      }
    });
  })
);

/** Rename an admin, or change which tools they may use. */
adminAccountsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const target = await loadOtherAdmin(req.params.id, req.user!.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_ADMIN", "Please enter valid account details.", parsed.error.flatten());
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) {
      update.name = parsed.data.name;
    }
    if (parsed.data.permissions !== undefined) {
      update.adminPermissions = normalizeAdminPermissions(parsed.data.permissions);
    }

    const updated = await User.findByIdAndUpdate(target._id, { $set: update }, { new: true }).lean();

    res.json({
      admin: {
        id: String(updated!._id),
        name: updated!.name,
        email: updated!.email,
        permissions: normalizeAdminPermissions(updated!.adminPermissions),
        isSelf: false,
        createdAt: updated!.createdAt ?? null
      }
    });
  })
);

/**
 * Turn an admin back into an ordinary reader. The account, and everything it
 * created, survives — only the role and its permissions are dropped, so this is
 * reversible and never orphans a book or a conversation.
 */
adminAccountsRouter.post(
  "/:id/demote",
  asyncHandler(async (req, res) => {
    const target = await loadOtherAdmin(req.params.id, req.user!.id);

    await User.findByIdAndUpdate(target._id, {
      $set: { role: "user" },
      $unset: { adminPermissions: 1 }
    });

    res.json({ id: String(target._id), role: "user" });
  })
);

/** Load the admin being edited, refusing the two cases that make no sense. */
async function loadOtherAdmin(id: unknown, actingUserId: string) {
  const targetId = requireUserId(id);
  if (targetId === String(actingUserId)) {
    // Editing your own access is how an admin locks themselves out of the tool
    // they need to undo it. Another admin manager has to make the change — and
    // because nobody can strip themselves, at least one manager always remains.
    throw new ApiError(400, "CANNOT_EDIT_SELF", "You cannot change your own admin permissions.");
  }

  const target = await User.findOne({ _id: targetId, role: "admin" }).lean();
  if (!target) {
    throw new ApiError(404, "ADMIN_NOT_FOUND", "This admin account was not found.");
  }
  return target;
}

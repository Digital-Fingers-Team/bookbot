import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import {
  ADMIN_PERMISSIONS,
  User,
  normalizeAdminPermissions,
  type AdminPermission,
  type UserRole
} from "../../models/user.model.js";
import { Organization } from "../../models/organization.model.js";
import { ApiError } from "../../utils/api-error.js";
import { notifyAdmins } from "../notifications/notification.service.js";

type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  language: "en" | "ar";
  // True when the user can read at least one book (admins always; users once an
  // admin grants them a book or category). Drives the discovery-vs-library UI.
  hasAccess: boolean;
  // Empty for everyone who is not an admin. Admin screens and guards read this
  // rather than the bare role.
  adminPermissions: AdminPermission[];
  // Set for org_admins and students belonging to a subscribing organization.
  organizationId?: string;
  // False until the reader has accepted the reading agreement. The web reader
  // blocks on this, so it ships with every session rather than needing a
  // second round trip before a book can open.
  readingTermsAccepted: boolean;
};

export async function seedDefaultAdmin() {
  const email = env.DEFAULT_ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    return;
  }

  await User.create({
    name: "Admin",
    email,
    passwordHash: await bcrypt.hash(env.DEFAULT_ADMIN_PASSWORD, 12),
    role: "admin",
    adminPermissions: [...ADMIN_PERMISSIONS]
  });
}

/**
 * Admin accounts predate per-permission access control. Grant every admin that
 * has no permission field the full set, once, so upgrading the code can never
 * silently strip an account of tools it already had. Accounts that have been
 * given a list — even an empty one — are left exactly as configured.
 */
export async function backfillAdminPermissions(): Promise<number> {
  const result = await User.updateMany(
    { role: "admin", adminPermissions: { $exists: false } },
    { $set: { adminPermissions: [...ADMIN_PERMISSIONS] } }
  );
  return result.modifiedCount ?? 0;
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
  }

  const user = await User.create({
    name: input.name,
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: "user"
  });

  await notifyAdmins({
    type: "user_registered",
    title: "New user registered",
    message: `${user.name} created an account (${user.email}).`,
    href: "/users"
  });

  return buildSession(await toPublicUser(user));
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select("+passwordHash");
  if (!user) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  return buildSession(await toPublicUser(user));
}

export async function getUserFromToken(token: string): Promise<PublicUser> {
  try {
    const payload = jwt.verify(token, env.AUTH_JWT_SECRET) as JwtPayload;
    const user = await User.findById(payload.sub);
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Your session is no longer valid.");
    }
    return await toPublicUser(user);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, "UNAUTHORIZED", "Please sign in again.");
  }
}

export async function updateUserProfile(userId: string, input: { name: string; language: "en" | "ar" }) {
  const user = await User.findByIdAndUpdate(
    userId,
    { name: input.name, language: input.language },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Your session is no longer valid.");
  }

  return await toPublicUser(user);
}

export async function changeUserPassword(userId: string, input: { currentPassword: string; newPassword: string }) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Your session is no longer valid.");
  }

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "INVALID_PASSWORD", "Current password is incorrect.");
  }

  user.passwordHash = await bcrypt.hash(input.newPassword, 12);
  await user.save();
}

export async function acceptReadingTerms(userId: string): Promise<PublicUser> {
  const user = await User.findOneAndUpdate(
    { _id: userId, readingTermsAcceptedAt: { $exists: false } },
    { $set: { readingTermsAcceptedAt: new Date() } },
    { new: true }
  );

  // Already accepted: the filter matched nothing, so read the record as it is.
  const current = user ?? (await User.findById(userId));
  if (!current) {
    throw new ApiError(401, "UNAUTHORIZED", "Your session is no longer valid.");
  }

  return await toPublicUser(current);
}

function buildSession(user: PublicUser) {
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    },
    env.AUTH_JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { token, user };
}

async function toPublicUser(user: {
  _id: unknown;
  name: string;
  email: string;
  role: UserRole;
  language?: string;
  allowedBookIds?: unknown[];
  allowedCategories?: unknown[];
  organizationId?: unknown;
  adminPermissions?: unknown;
  readingTermsAcceptedAt?: unknown;
}): Promise<PublicUser> {
  let hasAccess =
    user.role === "admin" || Boolean(user.allowedBookIds?.length) || Boolean(user.allowedCategories?.length);
  if (!hasAccess && user.role === "org_admin" && user.organizationId) {
    const organization = await Organization.findById(user.organizationId, { allowedBookIds: 1, allowedCategories: 1 }).lean();
    hasAccess = Boolean(organization?.allowedBookIds?.length || organization?.allowedCategories?.length);
  }
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    language: user.language === "ar" ? "ar" : "en",
    hasAccess,
    adminPermissions: user.role === "admin" ? normalizeAdminPermissions(user.adminPermissions) : [],
    organizationId: user.organizationId ? String(user.organizationId) : undefined,
    readingTermsAccepted: Boolean(user.readingTermsAcceptedAt)
  };
}

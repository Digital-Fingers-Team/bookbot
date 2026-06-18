import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { User, type UserRole } from "../../models/user.model.js";
import { ApiError } from "../../utils/api-error.js";

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
    role: "admin"
  });
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

  return buildSession(toPublicUser(user));
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

  return buildSession(toPublicUser(user));
}

export async function getUserFromToken(token: string): Promise<PublicUser> {
  try {
    const payload = jwt.verify(token, env.AUTH_JWT_SECRET) as JwtPayload;
    const user = await User.findById(payload.sub);
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Your session is no longer valid.");
    }
    return toPublicUser(user);
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

  return toPublicUser(user);
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

function toPublicUser(user: { _id: unknown; name: string; email: string; role: UserRole; language?: string }): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    language: user.language === "ar" ? "ar" : "en"
  };
}

import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { changeUserPassword, loginUser, registerUser, updateUserProfile } from "../services/auth/auth.service.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(6).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128)
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  language: z.enum(["en", "ar"])
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128)
});

export const authRouter: ExpressRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_REGISTER_REQUEST", "Please enter valid account details.", parsed.error.flatten());
    }

    res.status(201).json(await registerUser(parsed.data));
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_LOGIN_REQUEST", "Please enter a valid email and password.", parsed.error.flatten());
    }

    res.json(await loginUser(parsed.data));
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_PROFILE_REQUEST", "Please enter valid profile details.", parsed.error.flatten());
    }

    const user = req.user;
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    }

    res.json({ user: await updateUserProfile(user.id, parsed.data) });
  })
);

authRouter.patch(
  "/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_PASSWORD_REQUEST", "Please enter valid password details.", parsed.error.flatten());
    }

    const user = req.user;
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    }

    await changeUserPassword(user.id, parsed.data);
    res.json({ changed: true });
  })
);

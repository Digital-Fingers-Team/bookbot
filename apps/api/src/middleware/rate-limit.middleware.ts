import rateLimit from "express-rate-limit";

const json = (message: string) => ({ error: { code: "RATE_LIMITED", message } });

/** Global limiter applied to the whole API. */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: json("Too many requests. Please slow down.")
});

/** Tight limiter for auth endpoints to blunt credential-stuffing / brute force. */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: json("Too many attempts. Please wait a minute and try again.")
});

/**
 * Support messaging. Generous enough for a real back-and-forth (and for the
 * inbox's polling), tight enough that one account can't flood the admin inbox.
 */
export const supportLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: json("Too many messages in a short time. Please wait a moment.")
});

/** Moderate limiter for the upload endpoint (admin, but expensive). */
export const uploadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: json("Too many uploads in a short time. Please wait a moment.")
});

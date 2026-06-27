import { randomBytes } from "node:crypto";
import { User } from "../../models/user.model.js";
import { ApiError } from "../../utils/api-error.js";
import { sealSecret } from "../../utils/secret-box.js";
import { findOmpUserIdByEmail, registerOmpAuthor } from "./omp.client.js";

export interface OmpAuthorLink {
  linked: boolean;
  ompUserId?: number;
  ompUsername?: string;
  linkedAt?: Date;
}

/** Public (no-secret) view of a user's OMP author link. */
function toLink(user: { ompUserId?: number | null; ompUsername?: string | null; ompLinkedAt?: Date | null }): OmpAuthorLink {
  if (!user.ompUserId) {
    return { linked: false };
  }
  return {
    linked: true,
    ompUserId: user.ompUserId,
    ompUsername: user.ompUsername ?? undefined,
    linkedAt: user.ompLinkedAt ?? undefined
  };
}

export async function getAuthorLink(userId: string): Promise<OmpAuthorLink> {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Your session is no longer valid.");
  }
  return toLink(user);
}

/** Derive an OMP-safe username base from an email local part. */
function usernameBase(email: string): string {
  const base = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  // OMP requires a non-empty username; pad short ones to stay valid.
  return base.length >= 4 ? base.slice(0, 24) : `author${base}`;
}

/** Strong random password that satisfies OMP's length requirement. */
function generatePassword(): string {
  return `${randomBytes(12).toString("base64url")}A9!`;
}

/**
 * Ensure the bookbot user has a linked OMP author account, creating one if
 * needed. Idempotent: returns the existing link without re-registering.
 */
export async function activateAuthorAccount(userId: string): Promise<OmpAuthorLink> {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Your session is no longer valid.");
  }
  if (user.ompUserId) {
    return toLink(user);
  }

  const email = user.email.toLowerCase();

  // If an OMP user already exists for this email (e.g. created before linking),
  // we cannot recover its password — surface a clear, actionable error.
  const existingId = await findOmpUserIdByEmail(email);
  if (existingId) {
    throw new ApiError(
      409,
      "OMP_USER_EXISTS",
      "An OMP account already uses this email. Ask an admin to link it, or sign in to OMP directly."
    );
  }

  const [givenName, ...rest] = user.name.trim().split(/\s+/);
  const familyName = rest.join(" ") || givenName || "Author";
  const password = generatePassword();

  // Try a few usernames in case of a collision with an existing account.
  const base = usernameBase(email);
  let lastReason = "Registration failed.";
  for (let attempt = 0; attempt < 4; attempt++) {
    const username = attempt === 0 ? base : `${base}${randomBytes(2).toString("hex")}`.slice(0, 28);
    const result = await registerOmpAuthor({
      username,
      email,
      givenName: givenName || "Author",
      familyName,
      password,
      affiliation: "Arado"
    });

    if (result.ok && result.ompUserId) {
      user.ompUserId = result.ompUserId;
      user.ompUsername = username;
      user.ompPasswordEnc = sealSecret(password);
      user.ompLinkedAt = new Date();
      await user.save();
      return toLink(user);
    }
    lastReason = result.reason ?? lastReason;
  }

  throw new ApiError(502, "OMP_REGISTRATION_FAILED", `Could not create the OMP author account. ${lastReason}`);
}

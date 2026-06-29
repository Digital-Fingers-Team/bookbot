import { createHmac, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { User } from "../../models/user.model.js";
import { ApiError } from "../../utils/api-error.js";
import { sealSecret } from "../../utils/secret-box.js";
import { findOmpUserByEmail, findOmpUserIdByEmail, registerOmpAuthor } from "./omp.client.js";

/** Seconds an SSO login token stays valid. Kept short — it's a one-shot launch. */
const SSO_TOKEN_TTL_SECONDS = 120;

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64url");

/**
 * Build a signed auto-login URL into OMP for a linked user. The aradobotSso
 * plugin in OMP verifies the HMAC + expiry, opens a session, and grants the
 * Author role. Token = base64url(JSON{uid,exp}) "." base64url(HMAC-SHA256).
 */
export async function buildOmpLoginUrl(userId: string): Promise<string> {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Your session is no longer valid.");
  }
  if (!user.ompUserId) {
    throw new ApiError(409, "OMP_NOT_LINKED", "Activate your author account before opening OMP.");
  }

  const claims: { uid: number; exp: number; adm?: 1 } = {
    uid: user.ompUserId,
    exp: Math.floor(Date.now() / 1000) + SSO_TOKEN_TTL_SECONDS
  };
  // aradobot admins get OMP admin roles (site admin + press manager) on login.
  if (user.role === "admin") {
    claims.adm = 1;
  }
  const payload = b64url(JSON.stringify(claims));
  const sig = b64url(createHmac("sha256", env.OMP_SSO_SECRET).update(payload).digest());
  const token = `${payload}.${sig}`;
  return `${env.OMP_BASE_URL}/index.php/${env.OMP_CONTEXT_PATH}/bbsso/login?token=${token}`;
}

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
 * Ensure the aradobot user has a linked OMP author account, creating one if
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

  // If an OMP account already exists for this email (e.g. created in an earlier
  // attempt, or registered directly in OMP), link it instead of failing. SSO
  // login is id-based and needs no password, so we just record the id.
  const existing = await findOmpUserByEmail(email);
  if (existing) {
    user.ompUserId = existing.id;
    user.ompUsername = existing.userName ?? user.ompUsername;
    user.ompLinkedAt = new Date();
    await user.save();
    return toLink(user);
  }

  const [givenName, ...rest] = user.name.trim().split(/\s+/);
  const familyName = rest.join(" ") || givenName || "Author";
  const password = generatePassword();

  // Try a few usernames in case of a collision with an existing account.
  // Retry ONLY when OMP rejected the form (created=false) — never after a
  // success, which would create a duplicate.
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

    if (result.created) {
      // The OMP account now exists. Persist the link; the id should resolve,
      // but a successful registration must not fall through to a retry.
      const ompUserId = result.ompUserId ?? (await findOmpUserIdByEmail(email));
      if (!ompUserId) {
        throw new ApiError(502, "OMP_USER_UNRESOLVED", "Your OMP account was created but could not be linked. Please try opening OMP again shortly.");
      }
      user.ompUserId = ompUserId;
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

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "../config/env.js";

// AES-256-GCM reversible encryption for secrets we must later replay in
// plaintext (the OMP password used for SSO login). This is NOT password
// hashing — it is two-way encryption with a key derived from OMP_USER_SECRET.

const KEY = scryptSync(env.OMP_USER_SECRET, "bookbot-omp-secret-box", 32);
const IV_LENGTH = 12;

/** Encrypt plaintext → "iv.tag.ciphertext" (all base64url). */
export function sealSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

/** Reverse of sealSecret. Throws if the payload is malformed or tampered. */
export function openSecret(sealed: string): string {
  const [ivB64, tagB64, dataB64] = sealed.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed sealed secret.");
  }
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}

import { isValidObjectId } from "mongoose";
import { ApiError } from "./api-error.js";

export function requireObjectId(value: unknown, errorCode: string, message: string): string {
  if (typeof value !== "string" || !isValidObjectId(value)) {
    throw new ApiError(400, errorCode, message);
  }
  return value;
}

export function requireBookId(value: unknown): string {
  return requireObjectId(value, "INVALID_BOOK_ID", "The book id is invalid.");
}

export function requireUserId(value: unknown): string {
  return requireObjectId(value, "INVALID_USER_ID", "The user id is invalid.");
}

export function requireOrgId(value: unknown): string {
  return requireObjectId(value, "INVALID_ORG_ID", "The organization id is invalid.");
}

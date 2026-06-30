import { Types } from "mongoose";

/**
 * Keyset (cursor) pagination over a `createdAt`-descending list, with `_id` as a
 * tiebreaker. Cursors are opaque base64 of "<createdAtISO>|<id>". Stable under
 * inserts and cheap (no large skips), unlike offset pagination.
 */
export type PageParams = {
  limit: number;
  cursor: { createdAt: Date; id: Types.ObjectId } | null;
};

export function parsePageParams(query: unknown, defaultLimit = 50, maxLimit = 100): PageParams {
  const q = (query ?? {}) as { limit?: unknown; cursor?: unknown };
  const rawLimit = Number(q.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxLimit) : defaultLimit;
  return { limit, cursor: decodeCursor(typeof q.cursor === "string" ? q.cursor : "") };
}

/** Mongo filter fragment that selects rows strictly "after" the cursor. */
export function cursorFilter(cursor: PageParams["cursor"]): Record<string, unknown> {
  if (!cursor) {
    return {};
  }
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }
    ]
  };
}

/** Build the next-page cursor from the last returned row (null when no more). */
export function nextCursor(
  rows: { _id: unknown; createdAt?: Date | null }[],
  limit: number
): string | null {
  const last = rows[rows.length - 1];
  if (rows.length < limit || !last) {
    return null;
  }
  const createdAt = last.createdAt instanceof Date ? last.createdAt : new Date();
  return encodeCursor(createdAt, String(last._id));
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(value: string): PageParams["cursor"] {
  if (!value) {
    return null;
  }
  try {
    const [iso, id] = Buffer.from(value, "base64url").toString("utf8").split("|");
    if (!iso || !id || !Types.ObjectId.isValid(id)) {
      return null;
    }
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id: new Types.ObjectId(id) };
  } catch {
    return null;
  }
}

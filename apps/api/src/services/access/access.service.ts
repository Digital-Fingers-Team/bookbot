import { Book } from "../../models/book.model.js";
import { User } from "../../models/user.model.js";
import type { PublicUser } from "../auth/auth.service.js";

// Whether a user may read / ask the AI about a book. Admins get everything;
// regular users get the books an admin granted them, either directly or via a
// granted category.
export type AccessScope = { all: true } | { all: false; bookIds: Set<string> };

/** Resolve the set of books a user is allowed to read / query. */
export async function resolveAccessScope(user: Pick<PublicUser, "id" | "role">): Promise<AccessScope> {
  if (user.role === "admin") {
    return { all: true };
  }

  const record = await User.findById(user.id, { allowedBookIds: 1, allowedCategories: 1 }).lean();
  const bookIds = new Set<string>((record?.allowedBookIds ?? []).map((id) => String(id)));
  const categories = record?.allowedCategories ?? [];

  if (categories.length) {
    const inCategories = await Book.find(
      { $or: [{ categories: { $in: categories } }, { category: { $in: categories } }] },
      { _id: 1 }
    ).lean();
    for (const book of inCategories) {
      bookIds.add(String(book._id));
    }
  }

  // Free books should be readable without an explicit grant. Books created
  // before the `price` field existed have no price stored at all, and $lte
  // doesn't match a missing field, so treat "missing" the same as "<= 0".
  const freeBooks = await Book.find(
    { $or: [{ price: { $lte: 0 } }, { price: { $exists: false } }], status: "ready" },
    { _id: 1 }
  ).lean();
  for (const book of freeBooks) {
    bookIds.add(String(book._id));
  }

  return { all: false, bookIds };
}

/** True if the resolved scope permits a given book. */
export function canAccessBook(scope: AccessScope, bookId: string): boolean {
  return scope.all || scope.bookIds.has(String(bookId));
}

/** Plain array of allowed ids (for query filters); null means "all". */
export function allowedBookIdList(scope: AccessScope): string[] | null {
  return scope.all ? null : Array.from(scope.bookIds);
}

/**
 * Whether a user may download the raw file for a book. Narrower than read
 * access: admins always can, everyone else needs an explicit per-book grant
 * (defaults closed, unlike allowedBookIds/allowedCategories view access).
 */
export async function canDownloadBook(user: Pick<PublicUser, "id" | "role">, bookId: string): Promise<boolean> {
  if (user.role === "admin") {
    return true;
  }
  const record = await User.findById(user.id, { allowedDownloadBookIds: 1 }).lean();
  return (record?.allowedDownloadBookIds ?? []).some((id) => String(id) === String(bookId));
}

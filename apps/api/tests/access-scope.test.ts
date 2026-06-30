import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Mongoose models the service queries so we can drive resolveAccessScope
// without a database.
const userFindById = vi.fn();
const bookFind = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  User: {
    findById: (...args: unknown[]) => userFindById(...args)
  }
}));

vi.mock("../src/models/book.model.js", () => ({
  Book: {
    find: (...args: unknown[]) => bookFind(...args)
  }
}));

const {
  resolveAccessScope,
  canAccessBook,
  allowedBookIdList
} = await import("../src/services/access/access.service.js");

function lean<T>(value: T) {
  return { lean: async () => value };
}

describe("access scope — pure helpers", () => {
  it("admin scope allows any book", () => {
    const scope = { all: true } as const;
    expect(canAccessBook(scope, "anything")).toBe(true);
    expect(allowedBookIdList(scope)).toBeNull();
  });

  it("restricted scope allows only granted ids", () => {
    const scope = { all: false as const, bookIds: new Set(["a", "b"]) };
    expect(canAccessBook(scope, "a")).toBe(true);
    expect(canAccessBook(scope, "c")).toBe(false);
    expect(allowedBookIdList(scope)?.sort()).toEqual(["a", "b"]);
  });

  it("empty restricted scope denies everything", () => {
    const scope = { all: false as const, bookIds: new Set<string>() };
    expect(canAccessBook(scope, "a")).toBe(false);
    expect(allowedBookIdList(scope)).toEqual([]);
  });
});

describe("access scope — resolveAccessScope", () => {
  beforeEach(() => {
    userFindById.mockReset();
    bookFind.mockReset();
  });

  it("returns all-access for admins without touching the DB", async () => {
    const scope = await resolveAccessScope({ id: "u1", role: "admin" });
    expect(scope).toEqual({ all: true });
    expect(userFindById).not.toHaveBeenCalled();
  });

  it("unions directly-granted books with books in granted categories", async () => {
    userFindById.mockReturnValue(lean({ allowedBookIds: ["b1", "b2"], allowedCategories: ["leadership"] }));
    bookFind.mockReturnValue(lean([{ _id: "b3" }, { _id: "b2" }]));

    const scope = await resolveAccessScope({ id: "u1", role: "user" });

    expect(scope.all).toBe(false);
    expect(allowedBookIdList(scope)?.sort()).toEqual(["b1", "b2", "b3"]);
    expect(canAccessBook(scope, "b3")).toBe(true);
    expect(canAccessBook(scope, "b9")).toBe(false);
  });

  it("handles a user with no grants", async () => {
    userFindById.mockReturnValue(lean({ allowedBookIds: [], allowedCategories: [] }));

    const scope = await resolveAccessScope({ id: "u1", role: "user" });

    expect(scope).toEqual({ all: false, bookIds: new Set() });
    expect(bookFind).not.toHaveBeenCalled();
  });

  it("handles a missing user record gracefully", async () => {
    userFindById.mockReturnValue(lean(null));

    const scope = await resolveAccessScope({ id: "ghost", role: "user" });

    expect(canAccessBook(scope, "anything")).toBe(false);
  });
});

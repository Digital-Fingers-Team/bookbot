import { beforeEach, describe, expect, it, vi } from "vitest";

const findOneAndUpdate = vi.fn();
const findById = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  User: {
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
    findById: (...args: unknown[]) => findById(...args)
  },
  ADMIN_PERMISSIONS: [],
  normalizeAdminPermissions: () => []
}));

vi.mock("../src/models/organization.model.js", () => ({
  Organization: { findById: vi.fn() }
}));

vi.mock("../src/services/notifications/notification.service.js", () => ({
  notifyAdmins: vi.fn()
}));

const { acceptReadingTerms } = await import("../src/services/auth/auth.service.js");

function reader(readingTermsAcceptedAt?: Date) {
  return {
    _id: "user-1",
    name: "Reader",
    email: "reader@example.com",
    role: "user" as const,
    language: "ar",
    allowedBookIds: ["book-1"],
    readingTermsAcceptedAt
  };
}

describe("acceptReadingTerms", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    findById.mockReset();
  });

  it("stamps the acceptance and reports it on the session user", async () => {
    findOneAndUpdate.mockResolvedValue(reader(new Date("2026-09-22T10:00:00Z")));

    const user = await acceptReadingTerms("user-1");

    expect(user.readingTermsAccepted).toBe(true);
    // Only a reader who has not accepted is stamped, so the first acceptance
    // is the one the audit trail keeps.
    expect(findOneAndUpdate.mock.calls[0]?.[0]).toEqual({
      _id: "user-1",
      readingTermsAcceptedAt: { $exists: false }
    });
  });

  it("is idempotent: a second acceptance reads the record instead of restamping", async () => {
    findOneAndUpdate.mockResolvedValue(null);
    findById.mockResolvedValue(reader(new Date("2026-09-01T10:00:00Z")));

    const user = await acceptReadingTerms("user-1");

    expect(user.readingTermsAccepted).toBe(true);
    expect(findById).toHaveBeenCalledWith("user-1");
  });

  it("reports a reader who has never accepted as not accepted", async () => {
    findOneAndUpdate.mockResolvedValue(null);
    findById.mockResolvedValue(reader(undefined));

    const user = await acceptReadingTerms("user-1");

    expect(user.readingTermsAccepted).toBe(false);
  });
});

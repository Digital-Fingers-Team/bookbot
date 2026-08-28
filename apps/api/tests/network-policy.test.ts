import { beforeEach, describe, expect, it, vi } from "vitest";

const bookFindById = vi.fn();
const organizationFind = vi.fn();

vi.mock("../src/models/book.model.js", () => ({
  Book: { findById: (...args: unknown[]) => bookFindById(...args), find: vi.fn() }
}));

vi.mock("../src/models/organization.model.js", () => ({
  Organization: { find: (...args: unknown[]) => organizationFind(...args) }
}));

const {
  isIpAllowed,
  normalizeCidr,
  normalizeIp,
  resolveNetworkBookAccess,
  resolveNetworkBookIds,
  validateCidr,
  validateIp
} = await import("../src/services/access/network-policy.service.js");

function lean<T>(value: T) {
  return { lean: async () => value };
}

describe("network policy IP helpers", () => {
  it("normalizes single IPv4 and IPv6 addresses to host CIDRs", () => {
    expect(normalizeCidr("197.10.20.15")).toBe("197.10.20.15/32");
    expect(normalizeCidr("2001:db8::1")).toBe("2001:db8:0:0:0:0:0:1/128");
    expect(normalizeIp("::ffff:197.10.20.15")).toBe("197.10.20.15");
  });

  it("matches IPv4 and IPv6 CIDRs and rejects invalid input", () => {
    expect(isIpAllowed("197.10.20.15", ["197.10.20.0/24"])).toBe(true);
    expect(isIpAllowed("197.10.21.15", ["197.10.20.0/24"])).toBe(false);
    expect(isIpAllowed("2001:db8::10", ["2001:db8::/64"])).toBe(true);
    expect(isIpAllowed("::ffff:197.10.20.15", ["197.10.20.0/24"])).toBe(true);
    expect(validateIp("not-an-ip")).toBe(false);
    expect(validateCidr("197.10.20.0/99")).toBe(false);
  });
});

describe("network organization resolution", () => {
  beforeEach(() => {
    bookFindById.mockReset();
    organizationFind.mockReset();
  });

  it("allows a book when any subscribed organization matches the request IP", async () => {
    bookFindById.mockReturnValue(lean({ _id: "507f1f77bcf86cd799439011", category: "education", categories: [] }));
    organizationFind.mockReturnValue(
      lean([
        { _id: "org-a", allowedBookIds: ["507f1f77bcf86cd799439011"], allowedIpCidrs: ["197.10.21.0/24"], networkRestrictionEnabled: true },
        { _id: "org-b", allowedBookIds: ["507f1f77bcf86cd799439011"], allowedIpCidrs: ["197.10.20.0/24"], networkRestrictionEnabled: true, downloadableBookIds: ["507f1f77bcf86cd799439011"] }
      ])
    );

    await expect(resolveNetworkBookAccess("507f1f77bcf86cd799439011", "197.10.20.15")).resolves.toEqual({
      allowed: true,
      organizationIds: ["org-b"],
      matchedCidrs: ["197.10.20.0/24"],
      downloadable: true
    });
  });

  it("resolves direct and category subscriptions for the anonymous catalog scope", async () => {
    organizationFind.mockReturnValue(
      lean([
        { _id: "org-a", allowedBookIds: ["507f1f77bcf86cd799439011"], allowedCategories: ["education"], allowedIpCidrs: ["197.10.20.0/24"], networkRestrictionEnabled: true },
        { _id: "org-b", allowedBookIds: ["507f1f77bcf86cd799439012"], allowedIpCidrs: ["197.10.21.0/24"], networkRestrictionEnabled: true }
      ])
    );
    const bookFind = (await import("../src/models/book.model.js")).Book.find as unknown as ReturnType<typeof vi.fn>;
    bookFind.mockReturnValue(lean([{ _id: "book-3" }]));

    await expect(resolveNetworkBookIds("197.10.20.8")).resolves.toEqual(new Set(["507f1f77bcf86cd799439011", "book-3"]));
  });
});

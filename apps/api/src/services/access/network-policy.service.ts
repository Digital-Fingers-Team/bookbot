import type { Request } from "express";
import ipaddr from "ipaddr.js";
import { Types } from "mongoose";
import { Book } from "../../models/book.model.js";
import { Organization } from "../../models/organization.model.js";
import { ApiError } from "../../utils/api-error.js";

export type NetworkBookAccess = {
  allowed: boolean;
  organizationIds: string[];
  matchedCidrs: string[];
  downloadable: boolean;
};

export type NetworkPolicyInput = {
  networkRestrictionEnabled: boolean;
  allowedIpCidrs: string[];
  downloadableBookIds?: string[];
};

type OrganizationAccessRecord = {
  _id: unknown;
  allowedBookIds?: unknown[];
  allowedCategories?: string[];
  allowedIpCidrs?: string[];
  downloadableBookIds?: unknown[];
  networkRestrictionEnabled?: boolean;
  lastObservedIp?: string | null;
  networkPolicyUpdatedAt?: Date | null;
};

export function validateIp(value: string): boolean {
  return Boolean(normalizeIp(value));
}

export function validateCidr(value: string): boolean {
  return Boolean(parseCidr(value));
}

/** Normalize IPv4/IPv6, including IPv4-mapped IPv6 addresses. */
export function normalizeIp(value: string): string | null {
  const trimmed = value.trim().replace(/^\[|\]$/g, "");
  if (!trimmed || !ipaddr.isValid(trimmed)) {
    return null;
  }

  const address = ipaddr.parse(trimmed);
  if (isIpv4Mapped(address)) {
    return address.toIPv4Address().toString();
  }
  return address.toNormalizedString();
}

/** Normalize a single address as a host CIDR. */
export function normalizeCidr(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes("/")) {
    const ip = normalizeIp(trimmed);
    if (!ip) return null;
    return `${ip}/${ipaddr.parse(ip).kind() === "ipv4" ? 32 : 128}`;
  }

  const parsed = parseCidr(trimmed);
  if (!parsed) return null;
  const [address, prefix] = parsed;
  return `${isIpv4Mapped(address) ? address.toIPv4Address().toString() : address.toNormalizedString()}/${prefix}`;
}

export function isIpAllowed(clientIp: string, cidrs: string[]): boolean {
  const normalizedIp = normalizeIp(clientIp);
  if (!normalizedIp) return false;

  const address = ipaddr.parse(normalizedIp);
  return cidrs.some((cidr) => {
    const parsed = parseCidr(cidr);
    if (!parsed) return false;
    const [network, prefix] = parsed;
    const comparable = isIpv4Mapped(network) ? network.toIPv4Address() : network;
    return comparable.kind() === address.kind() && address.match(comparable, prefix);
  });
}

/** Express's req.ip is trusted only after app-level trust-proxy configuration. */
export function resolveClientIp(req: Request): string {
  return normalizeIp(req.ip || req.socket.remoteAddress || "") ?? "";
}

export function organizationHasBookEntitlement(
  organization: Pick<OrganizationAccessRecord, "allowedBookIds" | "allowedCategories">,
  book: { _id: unknown; category?: string; categories?: string[] }
): boolean {
  const bookId = String(book._id);
  if ((organization.allowedBookIds ?? []).some((id) => String(id) === bookId)) {
    return true;
  }

  const bookCategories = new Set([book.category ?? "", ...(book.categories ?? [])].filter(Boolean));
  return (organization.allowedCategories ?? []).some((category) => bookCategories.has(category));
}

/** Resolve anonymous network access for one book. */
export async function resolveNetworkBookAccess(bookId: string, clientIp: string): Promise<NetworkBookAccess> {
  if (!Types.ObjectId.isValid(bookId)) {
    return { allowed: false, organizationIds: [], matchedCidrs: [], downloadable: false };
  }
  const book = await Book.findById(bookId, { _id: 1, category: 1, categories: 1 }).lean();
  if (!book) {
    return { allowed: false, organizationIds: [], matchedCidrs: [], downloadable: false };
  }

  const entitlementFilter: Record<string, unknown>[] = [{ allowedBookIds: book._id }];
  const categories = [...new Set([book.category ?? "", ...(book.categories ?? [])].filter(Boolean))];
  if (categories.length) {
    entitlementFilter.push({ allowedCategories: { $in: categories } });
  }

  const organizations = await Organization.find(
    {
      networkRestrictionEnabled: true,
      $or: entitlementFilter
    },
    { allowedBookIds: 1, allowedCategories: 1, allowedIpCidrs: 1, downloadableBookIds: 1, networkRestrictionEnabled: 1 }
  ).lean();

  const organizationIds: string[] = [];
  const matchedCidrs: string[] = [];
  let downloadable = false;

  for (const organization of organizations as OrganizationAccessRecord[]) {
    if (!organizationHasBookEntitlement(organization, book) || !organization.networkRestrictionEnabled) {
      continue;
    }
    const matched = (organization.allowedIpCidrs ?? []).filter((cidr) => isIpAllowed(clientIp, [cidr]));
    if (!matched.length) continue;

    organizationIds.push(String(organization._id));
    matchedCidrs.push(...matched);
    if ((organization.downloadableBookIds ?? []).some((id) => String(id) === bookId)) {
      downloadable = true;
    }
  }

  return { allowed: organizationIds.length > 0, organizationIds, matchedCidrs, downloadable };
}

/** Resolve all books available to an anonymous caller from the current IP. */
export async function resolveNetworkBookIds(clientIp: string): Promise<Set<string>> {
  const organizations = await Organization.find(
    { networkRestrictionEnabled: true },
    { allowedBookIds: 1, allowedCategories: 1, allowedIpCidrs: 1 }
  ).lean();
  const directIds = new Set<string>();
  const categories = new Set<string>();

  for (const organization of organizations as OrganizationAccessRecord[]) {
    if (!isIpAllowed(clientIp, organization.allowedIpCidrs ?? [])) continue;
    for (const id of organization.allowedBookIds ?? []) directIds.add(String(id));
    for (const category of organization.allowedCategories ?? []) categories.add(category);
  }

  if (categories.size) {
    const categoryBooks = await Book.find(
      { status: "ready", $or: [{ categories: { $in: [...categories] } }, { category: { $in: [...categories] } }] },
      { _id: 1 }
    ).lean();
    for (const book of categoryBooks) directIds.add(String(book._id));
  }

  return directIds;
}

export function networkPolicyResponse(organization: OrganizationAccessRecord) {
  return {
    networkRestrictionEnabled: Boolean(organization.networkRestrictionEnabled),
    allowedIpCidrs: organization.allowedIpCidrs ?? [],
    downloadableBookIds: (organization.downloadableBookIds ?? []).map(String),
    lastObservedIp: organization.lastObservedIp ?? null,
    networkPolicyUpdatedAt: organization.networkPolicyUpdatedAt ?? null
  };
}

export async function saveNetworkPolicy(orgId: string, input: NetworkPolicyInput, actorId: string) {
  const organization = await Organization.findById(orgId).lean();
  if (!organization) {
    throw new ApiError(404, "ORG_NOT_FOUND", "This organization was not found.");
  }

  const allowedIpCidrs = normalizeCidrs(input.allowedIpCidrs);
  const downloadableBookIds = [...new Set(input.downloadableBookIds ?? [])];
  const books = downloadableBookIds.length
    ? await Book.find({ _id: { $in: downloadableBookIds } }, { _id: 1, category: 1, categories: 1 }).lean()
    : [];
  if (books.length !== downloadableBookIds.length) {
    throw new ApiError(400, "INVALID_DOWNLOAD_BOOK", "Every downloadable book must exist.");
  }
  for (const book of books) {
    if (!organizationHasBookEntitlement(organization, book)) {
      throw new ApiError(400, "DOWNLOAD_BOOK_NOT_IN_CATALOG", "A downloadable book must be in the organization's catalog.");
    }
  }

  const updated = await Organization.findByIdAndUpdate(
    orgId,
    {
      $set: {
        networkRestrictionEnabled: input.networkRestrictionEnabled,
        allowedIpCidrs,
        downloadableBookIds,
        networkPolicyUpdatedAt: new Date(),
        networkPolicyUpdatedBy: actorId
      }
    },
    { new: true }
  ).lean();
  return networkPolicyResponse(updated as OrganizationAccessRecord);
}

export async function testNetworkPolicy(orgId: string, clientIp: string) {
  const organization = await Organization.findById(orgId, { allowedIpCidrs: 1, networkRestrictionEnabled: 1 }).lean();
  if (!organization) {
    throw new ApiError(404, "ORG_NOT_FOUND", "This organization was not found.");
  }
  const normalizedIp = normalizeIp(clientIp);
  if (!normalizedIp) {
    throw new ApiError(400, "INVALID_IP", "The IP address is invalid.");
  }
  return {
    ip: normalizedIp,
    allowed: Boolean(organization.networkRestrictionEnabled) && isIpAllowed(normalizedIp, organization.allowedIpCidrs ?? []),
    matchedCidrs: (organization.allowedIpCidrs ?? []).filter((cidr) => isIpAllowed(normalizedIp, [cidr]))
  };
}

export function normalizeCidrs(values: string[]): string[] {
  const normalized = values.map(normalizeCidr);
  if (normalized.some((value) => !value)) {
    throw new ApiError(400, "INVALID_NETWORK_POLICY", "Every network address must be a valid IP or CIDR.");
  }
  return [...new Set(normalized as string[])];
}

function parseCidr(value: string): [ReturnType<typeof ipaddr.parse>, number] | null {
  try {
    const [rawAddress, rawPrefix] = ipaddr.parseCIDR(value.trim());
    const address = isIpv4Mapped(rawAddress) ? rawAddress.toIPv4Address() : rawAddress;
    const prefix = Number(rawPrefix);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > (address.kind() === "ipv4" ? 32 : 128)) {
      return null;
    }
    return [address, prefix];
  } catch {
    return null;
  }
}

function isIpv4Mapped(address: ReturnType<typeof ipaddr.parse>): address is ipaddr.IPv6 {
  return address.kind() === "ipv6" && (address as ipaddr.IPv6).isIPv4MappedAddress();
}

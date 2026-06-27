import { env } from "../../config/env.js";

const DEFAULT_TIMEOUT_MS = 8000;

/** OMP submission status published value (STATUS_PUBLISHED in OMP). */
const OMP_STATUS_PUBLISHED = 3;

export interface OmpHealth {
  reachable: boolean;
  status: number | null;
  baseUrl: string;
  error?: string;
}

export interface OmpCatalogItem {
  id: number;
  title: string;
  authors: string;
  datePublished: string | null;
  urlPublished: string | null;
}

export interface OmpCatalogResult {
  /** True once an API token is configured and OMP accepted the request. */
  configured: boolean;
  itemsCount: number;
  items: OmpCatalogItem[];
  status?: number;
  message?: string;
}

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

/** Low-level call to the OMP REST API. OMP reads the token from the
 *  `apiToken` query parameter (not an Authorization header). */
async function ompFetch(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const url = new URL(`${env.OMP_BASE_URL}${path}`);
  if (env.OMP_API_TOKEN) {
    url.searchParams.set("apiToken", env.OMP_API_TOKEN);
  }
  return fetch(url, { headers: { Accept: "application/json" }, signal: withTimeout(timeoutMs) });
}

function apiPath(suffix: string): string {
  return `/index.php/${env.OMP_CONTEXT_PATH}/api/v1/${suffix}`;
}

/** Liveness probe: is the OMP install reachable from the API? */
export async function checkOmpHealth(): Promise<OmpHealth> {
  try {
    const res = await fetch(env.OMP_BASE_URL, { method: "GET", signal: withTimeout(DEFAULT_TIMEOUT_MS) });
    return {
      // Any HTTP response (even a redirect) means OMP is up; 5xx means it is not healthy.
      reachable: res.status < 500,
      status: res.status,
      baseUrl: env.OMP_BASE_URL
    };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      baseUrl: env.OMP_BASE_URL,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

interface RawOmpSubmission {
  id: number;
  publications?: Array<{
    fullTitle?: Record<string, string> | string;
    authorsString?: string;
    datePublished?: string | null;
    urlPublished?: string | null;
  }>;
}

function pickLocalized(value: Record<string, string> | string | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.en ?? Object.values(value)[0] ?? "";
}

function mapSubmission(raw: RawOmpSubmission): OmpCatalogItem {
  const publication = raw.publications?.[0];
  return {
    id: raw.id,
    title: pickLocalized(publication?.fullTitle),
    authors: publication?.authorsString ?? "",
    datePublished: publication?.datePublished ?? null,
    urlPublished: publication?.urlPublished ?? null
  };
}

/**
 * Fetch published monographs from OMP's catalog.
 * Returns a structured "not configured" result (rather than throwing) when the
 * API token or press is missing, so the endpoint stays usable during setup.
 */
export async function fetchOmpCatalog(params: { count?: number } = {}): Promise<OmpCatalogResult> {
  if (!env.OMP_API_TOKEN) {
    return {
      configured: false,
      itemsCount: 0,
      items: [],
      message:
        "OMP_API_TOKEN is not set. In OMP, open admin Profile → API Key, generate a key, and set OMP_API_TOKEN."
    };
  }

  const count = params.count ?? 20;
  const res = await ompFetch(apiPath(`submissions?count=${count}&status=${OMP_STATUS_PUBLISHED}`));

  if (!res.ok) {
    return {
      configured: true,
      itemsCount: 0,
      items: [],
      status: res.status,
      message: `OMP API returned ${res.status}. Confirm a press exists at path "${env.OMP_CONTEXT_PATH}" and the token is valid.`
    };
  }

  const data = (await res.json()) as { items?: RawOmpSubmission[] };
  const items = (data.items ?? []).map(mapSubmission);
  return { configured: true, itemsCount: items.length, items };
}

// --- Author account provisioning ---------------------------------------------
// OMP 3.5's REST API is read-only for users (GET/HEAD), so we create the author
// through OMP's own public registration form. This runs OMP's native logic
// (password hashing, role bootstrap); the Author role is then granted
// automatically the first time the user starts a submission.

const webPath = (suffix: string): string => `${env.OMP_BASE_URL}/index.php/${env.OMP_CONTEXT_PATH}/${suffix}`;

/** Parse the csrfToken hidden input out of an OMP page. */
function extractCsrf(html: string): string | null {
  return html.match(/name="csrfToken"\s+value="([^"]+)"/)?.[1] ?? null;
}

/** Build a `Cookie` header (name=value pairs) from a Set-Cookie list. */
function cookieHeader(setCookies: string[]): string {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

export interface OmpRegistrationInput {
  username: string;
  email: string;
  givenName: string;
  familyName: string;
  password: string;
  affiliation?: string;
  country?: string;
}

export interface OmpRegistrationResult {
  ok: boolean;
  /** Present when ok: the new OMP user id resolved by email lookup. */
  ompUserId?: number;
  /** Present when !ok: a short reason (e.g. validation failure). */
  reason?: string;
}

/**
 * Register a new author in OMP via the public registration form.
 * Returns ok=false (rather than throwing) for expected validation failures
 * such as a taken username, so callers can retry with a different username.
 */
export async function registerOmpAuthor(input: OmpRegistrationInput): Promise<OmpRegistrationResult> {
  // 1) GET the register page to obtain a session cookie + CSRF token.
  const pageRes = await fetch(webPath("user/register"), { signal: withTimeout(DEFAULT_TIMEOUT_MS) });
  const cookies = cookieHeader(pageRes.headers.getSetCookie());
  const csrf = extractCsrf(await pageRes.text());
  if (!csrf || !cookies) {
    return { ok: false, reason: "Could not obtain a registration session from OMP." };
  }

  // 2) POST the registration with the same session.
  const body = new URLSearchParams({
    csrfToken: csrf,
    username: input.username,
    email: input.email,
    givenName: input.givenName,
    familyName: input.familyName,
    affiliation: input.affiliation ?? "",
    country: input.country ?? env.OMP_DEFAULT_COUNTRY,
    password: input.password,
    password2: input.password,
    privacyConsent: "1",
    emailConsent: "1"
  });

  const regRes = await fetch(webPath("user/register"), {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies },
    body,
    signal: withTimeout(DEFAULT_TIMEOUT_MS)
  });

  // OMP redirects (302) on success and re-renders the form (200) on validation error.
  if (regRes.status !== 302) {
    return { ok: false, reason: "OMP rejected the registration (username may be taken or fields invalid)." };
  }

  // 3) Resolve the new user's id by exact email match via the read API.
  const ompUserId = await findOmpUserIdByEmail(input.email);
  if (!ompUserId) {
    return { ok: false, reason: "Registration succeeded but the new OMP user could not be resolved." };
  }
  return { ok: true, ompUserId };
}

interface RawOmpUser {
  id: number;
  email: string;
}

/** Look up an OMP user id by exact (case-insensitive) email. */
export async function findOmpUserIdByEmail(email: string): Promise<number | null> {
  const res = await ompFetch(apiPath(`users?searchPhrase=${encodeURIComponent(email)}&count=10`));
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as { items?: RawOmpUser[] };
  const match = (data.items ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

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

/** Low-level call to the OMP REST API, attaching the token + JSON headers. */
async function ompFetch(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.OMP_API_TOKEN) {
    headers.Authorization = `Bearer ${env.OMP_API_TOKEN}`;
  }
  return fetch(`${env.OMP_BASE_URL}${path}`, { headers, signal: withTimeout(timeoutMs) });
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

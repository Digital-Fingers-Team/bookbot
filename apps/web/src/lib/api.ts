import type { ApiErrorResponse, AuthSession, Book, ChatResponse, Stats, User } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  token?: string;
  body?: unknown;
  method?: string;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiClientError(
      response.status,
      payload?.error.code ?? "REQUEST_FAILED",
      payload?.error.message ?? "The request failed. Please try again."
    );
  }

  return response.json() as Promise<T>;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatInput = {
  question: string;
  limit?: number;
  model?: string;
  bookId?: string;
  history?: ChatTurn[];
};

export function askQuestion(input: ChatInput, token?: string) {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: input,
    token
  });
}

export type StreamMeta = {
  sources: ChatResponse["sources"];
  evidence: ChatResponse["evidence"];
  usage: { retrievedChunks: number; vectorCandidateCount?: number };
};

export type StreamDone = {
  answer: string;
  usage: { model?: string; retrievedChunks: number };
};

export type StreamHandlers = {
  onMeta?: (meta: StreamMeta) => void;
  onToken?: (delta: string) => void;
  onDone?: (done: StreamDone) => void;
  onError?: (error: ApiClientError) => void;
  signal?: AbortSignal;
};

export async function streamQuestion(input: ChatInput, handlers: StreamHandlers, token?: string): Promise<void> {
  let response: Response;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    response = await fetch(`${API_URL}/api/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      signal: handlers.signal
    });
  } catch {
    handlers.onError?.(new ApiClientError(0, "NETWORK", "Could not reach the server."));
    return;
  }

  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    handlers.onError?.(
      new ApiClientError(
        response.status,
        payload?.error.code ?? "CHAT_FAILED",
        payload?.error.message ?? "The chat request failed."
      )
    );
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        dispatchSseEvent(buffer.slice(0, boundary), handlers);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }
  } catch (error) {
    if ((error as Error)?.name !== "AbortError") {
      handlers.onError?.(new ApiClientError(0, "STREAM_INTERRUPTED", "The connection was interrupted."));
    }
  }
}

function dispatchSseEvent(raw: string, handlers: StreamHandlers) {
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) {
    return;
  }

  let data: unknown;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }

  if (eventName === "meta") {
    handlers.onMeta?.(data as StreamMeta);
  } else if (eventName === "token") {
    handlers.onToken?.((data as { delta?: string }).delta ?? "");
  } else if (eventName === "done") {
    handlers.onDone?.(data as StreamDone);
  } else if (eventName === "error") {
    const errorData = data as { code?: string; message?: string };
    handlers.onError?.(
      new ApiClientError(0, errorData.code ?? "CHAT_FAILED", errorData.message ?? "The chat request failed.")
    );
  }
}

export function login(input: { email: string; password: string }) {
  return request<AuthSession>("/api/auth/login", {
    method: "POST",
    body: input
  });
}

export function register(input: { name: string; email: string; password: string }) {
  return request<AuthSession>("/api/auth/register", {
    method: "POST",
    body: input
  });
}

export function me(token: string) {
  return request<{ user: User }>("/api/auth/me", { token });
}

export function updateProfile(input: { name: string; language: "en" | "ar" }, token: string) {
  return request<{ user: User }>("/api/auth/me", {
    method: "PATCH",
    body: input,
    token
  });
}

export function changePassword(input: { currentPassword: string; newPassword: string }, token: string) {
  return request<{ changed: true }>("/api/auth/password", {
    method: "PATCH",
    body: input,
    token
  });
}

export type UploadedBook = {
  bookId: string;
  title: string;
  originalFileName: string;
  pageCount: number;
  chunkCount: number;
  status: "processing" | "ready" | "failed";
};

export async function uploadPdfs(files: File[], token?: string, price?: number) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  if (price && price > 0) {
    formData.append("price", String(price));
  }

  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers,
    body: formData
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiClientError(
      response.status,
      payload?.error.code ?? "UPLOAD_FAILED",
      payload?.error.message ?? "The upload failed. Please try again."
    );
  }

  return response.json() as Promise<{ books: UploadedBook[] }>;
}

export type AccessRequest = {
  id: string;
  targetType: "book" | "category";
  targetValue: string;
  targetLabel: string;
  note: string;
  amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string;
  createdAt: string;
  decidedAt: string | null;
  user?: { id: string; name: string; email: string };
};

/** Submit a payment-backed access request for a book or category. */
export async function submitAccessRequest(
  input: { targetType: "book" | "category"; targetValue: string; note: string; receipt: File },
  token?: string
) {
  const formData = new FormData();
  formData.append("targetType", input.targetType);
  formData.append("targetValue", input.targetValue);
  formData.append("note", input.note);
  formData.append("receipt", input.receipt);

  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}/api/access-requests`, { method: "POST", headers, body: formData });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiClientError(
      response.status,
      payload?.error.code ?? "REQUEST_FAILED",
      payload?.error.message ?? "Could not submit your request."
    );
  }
  return response.json() as Promise<{ id: string; status: string }>;
}

export function listAccessRequests(token?: string, status?: "pending" | "approved" | "rejected") {
  const qs = status ? `?status=${status}` : "";
  return request<{ requests: AccessRequest[] }>(`/api/access-requests${qs}`, { token });
}

/** Count of the user's requests that were decided but not yet seen. */
export function unseenRequestCount(token?: string) {
  return request<{ count: number }>("/api/access-requests/unseen-count", { token });
}

/** Mark the user's decided requests as seen (clears the notification). */
export function markRequestsSeen(token?: string) {
  return request<{ ok: boolean }>("/api/access-requests/mark-seen", { method: "POST", token });
}

export function decideAccessRequest(id: string, action: "approve" | "reject", adminNote: string, token?: string) {
  return request<{ id: string; status: string }>(`/api/access-requests/${id}/${action}`, {
    method: "POST",
    body: { adminNote },
    token
  });
}

/** Fetch a receipt image as an object URL (auth required). Caller revokes it. */
export async function fetchReceiptObjectUrl(id: string, token?: string): Promise<string> {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_URL}/api/access-requests/${id}/receipt`, { headers });
  if (!response.ok) {
    throw new ApiClientError(response.status, "RECEIPT_FAILED", "Could not load the receipt.");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  allowedCategories: string[];
  allowedBooks: { id: string; title: string }[];
};

export function listUsers(token?: string, search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<{ users: AdminUser[] }>(`/api/admin/users${qs}`, { token });
}

export function grantAccess(userId: string, targetType: "book" | "category", targetValue: string, token?: string) {
  return request<{ ok: boolean }>(`/api/admin/users/${userId}/grant`, {
    method: "POST",
    body: { targetType, targetValue },
    token
  });
}

export function revokeAccess(userId: string, targetType: "book" | "category", targetValue: string, token?: string) {
  return request<{ ok: boolean }>(`/api/admin/users/${userId}/revoke`, {
    method: "POST",
    body: { targetType, targetValue },
    token
  });
}

export function listBooks(token?: string) {
  return request<{ books: Book[] }>("/api/books", { token });
}

export type CatalogBook = { id: string; title: string; author: string; category: string };

/** Server-side typeahead over the whole catalog (title/author only, no content). */
export function searchBookCatalog(q: string, token?: string, limit = 20) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  qs.set("limit", String(limit));
  return request<{ books: CatalogBook[] }>(`/api/books/catalog?${qs.toString()}`, { token });
}

export function deleteBook(id: string, token?: string) {
  return request<{ deleted: true }>(`/api/books/${id}`, {
    method: "DELETE",
    token
  });
}

export function getCategories(token?: string) {
  return request<{ categories: string[] }>("/api/categories", { token });
}

export function addCategory(name: string, token?: string) {
  return request<{ categories: string[] }>("/api/categories", { method: "POST", body: { name }, token });
}

export function updateBook(
  id: string,
  patch: { category?: string; author?: string; featured?: boolean; description?: string; price?: number },
  token?: string
) {
  return request<{ id: string; category: string; author: string; featured: boolean; description: string; price: number }>(
    `/api/books/${id}`,
    { method: "PATCH", body: patch, token }
  );
}

export type DiscoveryBook = { id: string; title: string; author: string; category: string };

/** Ask the library guide which books/categories suit the user (metadata only). */
export function discoverBooks(question: string, token?: string) {
  return request<{ answer: string; books: DiscoveryBook[] }>("/api/chat/discover", {
    method: "POST",
    body: { question },
    token
  });
}

export type MyBook = Book & { favorite: boolean; lastPage: number; lastOpenedAt: string | null };

export function getBook(id: string, token?: string) {
  return request<MyBook>(`/api/books/${id}`, { token });
}

export function getMyBooks(token?: string) {
  return request<{ favorites: MyBook[]; continueReading: MyBook[]; owned: MyBook[] }>("/api/books/my", { token });
}

export function setFavorite(id: string, favorite: boolean, token?: string) {
  return request<{ favorite: boolean }>(`/api/books/${id}/favorite`, { method: "PUT", body: { favorite }, token });
}

export function setProgress(id: string, lastPage: number, token?: string) {
  return request<{ ok: true }>(`/api/books/${id}/progress`, { method: "PUT", body: { lastPage }, token });
}

export async function getBookPdf(id: string, token?: string) {
  const payload = await request<{ fileName: string; mimeType: string; data: string }>(`/api/books/${id}/pdf-data`, {
    token
  });
  const binary = atob(payload.data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: payload.mimeType || "application/pdf" });
}

export async function getBookPageImage(id: string, page: number, token?: string, signal?: AbortSignal) {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}/api/books/${id}/pages/${page}/image?scale=2`, {
    headers,
    signal,
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiClientError(
      response.status,
      payload?.error.code ?? "PAGE_IMAGE_FAILED",
      payload?.error.message ?? "The page image could not be loaded."
    );
  }

  return response.blob();
}

export function getStats(token?: string) {
  return request<Stats>("/api/stats", { token });
}

export type ShowcaseBook = { id: string; title: string; author: string };

/** Public showcase books for the landing carousel (no auth required). */
export function getShowcaseBooks(count = 12) {
  return request<{ books: ShowcaseBook[] }>(`/api/books/showcase?count=${count}`);
}

/** Public cover image URL (first page) for a showcase book. */
export function bookCoverUrl(id: string) {
  return `${API_URL}/api/books/${id}/cover`;
}

export type OmpAuthorLink = {
  linked: boolean;
  ompUserId?: number;
  ompUsername?: string;
  linkedAt?: string;
};

export function getOmpAuthorAccount(token: string) {
  return request<OmpAuthorLink>("/api/omp/author-account", { token });
}

export function activateOmpAuthorAccount(token: string) {
  return request<OmpAuthorLink>("/api/omp/author-account", { method: "POST", token });
}

export function getOmpLoginLink(token: string) {
  return request<{ url: string }>("/api/omp/login-link", { method: "POST", token });
}

export function sendFeedback(input: { vote: "up" | "down"; note?: string; question?: string; answer?: string }) {
  return request<{ received: true }>("/api/feedback", { method: "POST", body: input });
}

export type StoredSource = {
  bookId?: string;
  bookName?: string;
  pageNumber?: number;
  supportingText?: string;
};

export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: StoredSource[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

export type ConversationDetail = {
  id: string;
  title: string;
  messages: StoredMessage[];
  updatedAt: string;
};

export function listConversations(token: string) {
  return request<{ conversations: ConversationSummary[] }>("/api/conversations", { token });
}

export function getConversation(id: string, token: string) {
  return request<ConversationDetail>(`/api/conversations/${id}`, { token });
}

export function createConversation(input: { title?: string; messages: StoredMessage[] }, token: string) {
  return request<{ id: string; title: string }>("/api/conversations", { method: "POST", body: input, token });
}

export function updateConversation(id: string, input: { title?: string; messages: StoredMessage[] }, token: string) {
  return request<{ id: string; title: string }>(`/api/conversations/${id}`, { method: "PUT", body: input, token });
}

export function deleteConversation(id: string, token: string) {
  return request<{ deleted: true }>(`/api/conversations/${id}`, { method: "DELETE", token });
}

export function getBookConversation(bookId: string, token: string) {
  return request<{ messages: StoredMessage[] }>(`/api/conversations/book/${bookId}`, { token });
}

export function saveBookConversation(bookId: string, messages: StoredMessage[], token: string) {
  return request<{ ok: true }>(`/api/conversations/book/${bookId}`, { method: "PUT", body: { messages }, token });
}

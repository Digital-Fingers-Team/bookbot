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

export function askQuestion(input: { question: string; limit?: number; model?: string }) {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: input
  });
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
};

export async function uploadPdfs(files: File[], token?: string) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
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

export function listBooks(token?: string) {
  return request<{ books: Book[] }>("/api/books", { token });
}

export function deleteBook(id: string, token?: string) {
  return request<{ deleted: true }>(`/api/books/${id}`, {
    method: "DELETE",
    token
  });
}

export async function getBookPdf(id: string, token?: string) {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}/api/books/${id}/pdf`, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiClientError(
      response.status,
      payload?.error.code ?? "PDF_LOAD_FAILED",
      payload?.error.message ?? "Could not open this book."
    );
  }

  return response.blob();
}

export function getStats(token?: string) {
  return request<Stats>("/api/stats", { token });
}

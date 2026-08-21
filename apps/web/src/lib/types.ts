export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type UserRole = "admin" | "org_admin" | "user";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  language?: "en" | "ar";
  // True when the user can read at least one book (drives discovery-vs-library).
  hasAccess?: boolean;
  // Set for org_admins and students belonging to a subscribing organization.
  organizationId?: string;
};

export type AuthSession = {
  token: string;
  user: User;
};

export type BookStatus = "processing" | "ready" | "failed" | "cancelled";
export type SourceFormat = "pdf" | "epub" | "docx" | "txt";

export type Book = {
  id: string;
  title: string;
  originalFileName: string;
  sourceFormat: SourceFormat;
  createdAt: string;
  // When processing finished and the book became readable ("activation" date).
  readyAt?: string | null;
  chunkCount: number;
  pageCount: number;
  status: BookStatus;
  processedPages: number;
  error: string;
  author: string;
  category: string;
  categories: string[];
  description?: string;
  favorite?: boolean;
  featured?: boolean;
  // Sale price shown under the book; 0 means free.
  price?: number;
  // True when the current user may actually open/read this book. The library
  // lists every book; locked ones (accessible === false) can't be opened.
  accessible?: boolean;
  // True when an admin has separately granted this user download rights for
  // this book (narrower than read access; only set on the single-book detail
  // response). Missing/false hides the reader's Download/Open-in-tab buttons.
  canDownload?: boolean;
  firstPageText: string;
};

export type Source = {
  bookId?: string;
  bookName: string;
  pageNumber: number;
  supportingText: string;
};

export type Highlight = {
  term: string;
  start: number;
  end: number;
};

export type EvidenceChunk = {
  id: string;
  bookId: string;
  bookName: string;
  pageNumber: number;
  chunkText: string;
  score: number;
  highlights: Highlight[];
};

export type ChatResponse = {
  answer: string;
  sources: Source[];
  evidence: EvidenceChunk[];
  usage: {
    model?: string;
    retrievedChunks: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type Stats = {
  totalBooks: number;
  totalChunks: number;
  totalPages: number;
  revenue?: { total: number; thisMonth: number; currency: string; pendingRequests: number };
  unansweredQuestions?: { question: string; createdAt: string }[];
  feedback?: { up: number; down: number };
  reports?: { note: string; answer: string; createdAt: string }[];
  usage: Record<string, { total: number; successful: number; failed: number; totalTokens: number }>;
};

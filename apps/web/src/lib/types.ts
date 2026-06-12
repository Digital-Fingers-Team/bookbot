export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type Book = {
  id: string;
  title: string;
  originalFileName: string;
  createdAt: string;
  chunkCount: number;
  pageCount: number;
};

export type Source = {
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
  usage: Record<string, { total: number; successful: number; failed: number; totalTokens: number }>;
};

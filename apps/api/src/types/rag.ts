export type Highlight = {
  term: string;
  start: number;
  end: number;
};

export type RetrievedChunk = {
  id: string;
  bookId: string;
  bookName: string;
  pageNumber: number;
  chunkText: string;
  score: number;
  highlights: Highlight[];
};

export type Source = {
  bookName: string;
  pageNumber: number;
  supportingText: string;
};

export type ChatUsage = {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  retrievedChunks: number;
};

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
  chunkIndex?: number;
  chunkText: string;
  score: number;
  vectorScore?: number;
  highlights: Highlight[];
};

export type EvidenceChunk = {
  pageNumber: number;
  text: string;
  chunkId: string;
  score: number;
  highlights?: Highlight[];
};

export type EvidenceBook = {
  bookTitle: string;
  bookId: string;
  score: number;
  evidence: EvidenceChunk[];
};

export type StructuredSource = {
  bookTitle: string;
  bookId: string;
  pageNumber: number;
  bookName?: string;
  supportingText?: string;
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

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateAnswerInput = {
  question: string;
  chunks: RetrievedChunk[];
  model?: string;
  history?: ChatTurn[];
};

export type GenerateAnswerResult = {
  answer: string;
  model?: string;
  usage?: Omit<ChatUsage, "retrievedChunks">;
};

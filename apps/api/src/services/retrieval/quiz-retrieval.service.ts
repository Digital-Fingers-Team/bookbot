import { Types, isValidObjectId } from "mongoose";
import { Chunk } from "../../models/chunk.model.js";
import type { RetrievedChunk } from "../../types/rag.js";

export type QuizRetrievalResult = {
  chunks: RetrievedChunk[];
  vectorCandidateCount: number;
};

export async function retrievePageChunks(bookId: string, pageNumber: number): Promise<QuizRetrievalResult> {
  if (!isValidObjectId(bookId) || !Number.isFinite(pageNumber)) {
    return { chunks: [], vectorCandidateCount: 0 };
  }

  const documents = await Chunk.find({
    bookId: new Types.ObjectId(bookId),
    pageNumber: Math.max(1, Math.floor(pageNumber))
  })
    .select({ bookId: 1, bookName: 1, pageNumber: 1, chunkIndex: 1, chunkText: 1 })
    .sort({ chunkIndex: 1 })
    .lean();

  return {
    chunks: documents.map((document) => ({
      id: String(document._id),
      bookId: String(document.bookId),
      bookName: document.bookName,
      pageNumber: document.pageNumber,
      chunkIndex: document.chunkIndex,
      chunkText: document.chunkText,
      score: 1,
      highlights: []
    })),
    vectorCandidateCount: documents.length
  };
}

export async function retrieveBookChunks(bookId: string, topK = 30): Promise<QuizRetrievalResult> {
  if (!isValidObjectId(bookId)) {
    return { chunks: [], vectorCandidateCount: 0 };
  }

  const documents = await Chunk.aggregate([
    { $match: { bookId: new Types.ObjectId(bookId) } },
    { $sample: { size: Math.min(Math.max(topK, 1), 30) } },
    { $project: { bookId: 1, bookName: 1, pageNumber: 1, chunkIndex: 1, chunkText: 1 } }
  ]);
  documents.sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));

  return {
    chunks: documents.map((document) => ({
      id: String(document._id),
      bookId: String(document.bookId),
      bookName: document.bookName,
      pageNumber: document.pageNumber,
      chunkIndex: document.chunkIndex,
      chunkText: document.chunkText,
      score: 1,
      highlights: []
    })),
    vectorCandidateCount: documents.length
  };
}

import { createHash } from "node:crypto";
import { extname } from "node:path";
import { Book } from "../../models/book.model.js";
import { storage } from "./storage.service.js";

export const SUMMARY_AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
  "audio/aac": ".aac",
  "audio/flac": ".flac"
};

export type SummaryAudioInput = {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
};

export function isSummaryAudio(fileName: string, mimeType: string) {
  const normalizedMime = (mimeType.toLowerCase().split(";")[0] ?? "").trim();
  return Boolean(SUMMARY_AUDIO_TYPES[normalizedMime]) || /\.(mp3|m4a|wav|ogg|webm|aac|flac)$/i.test(fileName);
}

export async function attachSummaryAudio(bookId: string, input: SummaryAudioInput) {
  const book = await Book.findById(bookId, { summaryAudioPath: 1 });
  if (!book) return null;

  const mimeType = normalizeMimeType(input.mimeType, input.originalFileName);
  const extension = SUMMARY_AUDIO_TYPES[mimeType] ?? (extname(input.originalFileName).toLowerCase() || ".audio");
  const checksum = createHash("sha256").update(input.buffer).digest("hex");
  const key = `summary-audio/${bookId}-${checksum.slice(0, 16)}${extension}`;

  await storage.put(key, input.buffer, mimeType);
  if (book.summaryAudioPath && book.summaryAudioPath !== key) {
    await storage.delete(book.summaryAudioPath);
  }

  await Book.updateOne(
    { _id: bookId },
    {
      $set: {
        summaryAudioPath: key,
        summaryAudioFileName: input.originalFileName,
        summaryAudioMimeType: mimeType,
        summaryAudioSize: input.buffer.length,
        summaryAudioUploadedAt: new Date()
      }
    }
  );

  return {
    fileName: input.originalFileName,
    mimeType,
    size: input.buffer.length,
    uploadedAt: new Date()
  };
}

export async function removeSummaryAudio(bookId: string) {
  const book = await Book.findById(bookId, { summaryAudioPath: 1 });
  if (!book) return false;
  if (book.summaryAudioPath) await storage.delete(book.summaryAudioPath);
  await Book.updateOne(
    { _id: bookId },
    {
      $unset: {
        summaryAudioPath: 1,
        summaryAudioFileName: 1,
        summaryAudioMimeType: 1,
        summaryAudioSize: 1,
        summaryAudioUploadedAt: 1
      }
    }
  );
  return true;
}

export function summaryAudioMeta(book: {
  summaryAudioFileName?: string | null;
  summaryAudioMimeType?: string | null;
  summaryAudioSize?: number | null;
  summaryAudioUploadedAt?: Date | null;
} | null | undefined) {
  if (!book?.summaryAudioFileName || !book.summaryAudioMimeType) return null;
  return {
    fileName: book.summaryAudioFileName,
    mimeType: book.summaryAudioMimeType,
    size: book.summaryAudioSize ?? 0,
    uploadedAt: book.summaryAudioUploadedAt ?? null
  };
}

function normalizeMimeType(mimeType: string, fileName: string) {
  const normalized = (mimeType.toLowerCase().split(";")[0] ?? "").trim();
  if (SUMMARY_AUDIO_TYPES[normalized]) return normalized;
  const extension = extname(fileName).toLowerCase();
  const match = Object.entries(SUMMARY_AUDIO_TYPES).find(([, value]) => value === extension);
  return match?.[0] ?? "application/octet-stream";
}

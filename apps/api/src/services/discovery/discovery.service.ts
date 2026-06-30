import { env } from "../../config/env.js";
import { Book } from "../../models/book.model.js";
import { ApiError } from "../../utils/api-error.js";
import { readableBookTitle } from "../../utils/file-name.js";

export type DiscoveryBook = { id: string; title: string; author: string; category: string };
export type DiscoveryResult = { answer: string; books: DiscoveryBook[] };

const DISCOVERY_SYSTEM_PROMPT = `You are AradoBot's library guide. You help visitors discover which books in the library suit their interest, and which category to pick — BEFORE they have access to read any content.

Rules:
- Recommend ONLY from the catalog provided in the user message. Never invent titles, authors, or categories.
- You only know each book's title, author, category and short description — you do NOT have the book's contents, so never quote or claim to summarize inside pages.
- Answer in the same language as the user's question (Arabic or English).
- Be concise and helpful: suggest the most relevant book(s) and the category to choose, and say briefly why.
- If nothing in the catalog fits, say so honestly and suggest the closest category.

Respond with a JSON object exactly like:
{"answer": "<your helpful reply>", "bookIds": ["<id of each recommended book, most relevant first>"]}`;

type CatalogEntry = { id: string; title: string; author: string; category: string; description: string };

/** Recommend books from catalog metadata only (no access / no content). */
export async function discoverBooks(question: string, language: "ar" | "en" = "ar"): Promise<DiscoveryResult> {
  const catalog = await loadCatalog();
  if (!catalog.length) {
    return {
      answer: language === "ar" ? "لا توجد كتب متاحة في المكتبة بعد." : "There are no books in the library yet.",
      books: []
    };
  }

  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const userPrompt = buildCatalogPrompt(question, catalog);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aradobot.local",
        "X-Title": "AradoBot Discovery"
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DISCOVERY_SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`OpenRouter discovery error: ${response.status}`, body);
      throw new ApiError(502, "DISCOVERY_FAILURE", "The library guide is unavailable right now.");
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content?.trim();
    const parsed = parseDiscovery(content);

    const books = parsed.bookIds
      .map((id) => byId.get(id))
      .filter((entry): entry is CatalogEntry => Boolean(entry))
      .slice(0, 8)
      .map(({ id, title, author, category }) => ({ id, title, author, category }));

    return { answer: parsed.answer, books };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCatalog(): Promise<CatalogEntry[]> {
  const books = await Book.find(
    { status: "ready" },
    { title: 1, originalFileName: 1, author: 1, category: 1, description: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(80)
    .lean();

  return books.map((book) => ({
    id: String(book._id),
    title: readableBookTitle({ title: book.title, originalFileName: book.originalFileName, firstPageText: "" }),
    author: book.author ?? "",
    category: book.category ?? "",
    description: book.description ?? ""
  }));
}

function buildCatalogPrompt(question: string, catalog: CatalogEntry[]): string {
  const lines = catalog.map((entry) => {
    const parts = [`id: ${entry.id}`, `title: ${entry.title}`];
    if (entry.category) parts.push(`category: ${entry.category}`);
    if (entry.author) parts.push(`author: ${entry.author}`);
    if (entry.description) parts.push(`description: ${entry.description}`);
    return `- ${parts.join(" | ")}`;
  });
  return `Catalog:\n${lines.join("\n")}\n\nUser question:\n${question}`;
}

function parseDiscovery(content: string | undefined): { answer: string; bookIds: string[] } {
  if (!content) {
    return { answer: "", bookIds: [] };
  }
  try {
    const data = JSON.parse(content) as { answer?: unknown; bookIds?: unknown };
    const answer = typeof data.answer === "string" ? data.answer : "";
    const bookIds = Array.isArray(data.bookIds) ? data.bookIds.filter((id): id is string => typeof id === "string") : [];
    return { answer, bookIds };
  } catch {
    // If the model didn't return valid JSON, treat the whole thing as the answer.
    return { answer: content, bookIds: [] };
  }
}

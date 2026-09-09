import { env } from "../../config/env.js";
import { getLLMSettings } from "../../config/llm.js";
import { Category } from "../../models/category.model.js";
import { notifyAdmins } from "../notifications/notification.service.js";

export type CategorizationItem = {
  /** Caller-owned identifier echoed back on the suggestion (row number, book id…). */
  ref: string;
  title: string;
  author?: string;
  description?: string;
  /** Opening text of the book, when the content has already been extracted. */
  excerpt?: string;
};

export type CategorySuggestion = {
  ref: string;
  category: string;
  /** True when the model proposed a category that was not on the curated list. */
  isNew: boolean;
};

// Books are classified in batches so one oversized prompt cannot blow the
// model's context window on a 100-row workbook import.
const BATCH_SIZE = 20;
const MAX_EXCERPT_CHARS = 1200;
const MAX_DESCRIPTION_CHARS = 400;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_NEW_CATEGORY_CHARS = 80;

type ChatResponse = { choices?: Array<{ message?: { content?: string } }> };
type ModelResult = { ref?: unknown; category?: unknown };

function buildPrompt(items: CategorizationItem[], categories: string[]): string {
  const list = categories.length
    ? categories.map((name, index) => `${index + 1}. ${name}`).join("\n")
    : "(the list is empty — propose a category for every book)";

  const books = items
    .map((item) => {
      const lines = [`ref: ${item.ref}`, `title: ${item.title}`];
      if (item.author) lines.push(`author: ${item.author}`);
      if (item.description) lines.push(`description: ${item.description.slice(0, MAX_DESCRIPTION_CHARS)}`);
      if (item.excerpt) lines.push(`excerpt: ${item.excerpt.slice(0, MAX_EXCERPT_CHARS)}`);
      return lines.join("\n");
    })
    .join("\n---\n");

  return [
    "You are cataloguing books for an Arabic administrative-development library.",
    "",
    "Existing categories:",
    list,
    "",
    "Assign exactly one category to each book below. Prefer an existing category and",
    "copy its name character for character. Only when no existing category genuinely",
    "fits, invent a concise new one in the same language and style as the list.",
    "",
    "Books:",
    books,
    "",
    'Reply with JSON only: {"results":[{"ref":"<ref>","category":"<category name>"}]}',
    "Include every ref exactly once."
  ].join("\n");
}

async function classifyBatch(items: CategorizationItem[], categories: string[]): Promise<Map<string, string>> {
  const settings = getLLMSettings();
  if (settings.requiresApiKey && !settings.apiKey) {
    throw new Error("The AI provider is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
    if (settings.name === "OpenRouter") {
      headers["HTTP-Referer"] = "https://aradobot.local";
      headers["X-Title"] = "AradoBot";
    }

    // A reasoning model would burn the whole budget thinking and return a
    // truncated body, so classification runs on its own instruct model.
    const model = settings.name === "OpenRouter" ? env.CATEGORY_MODEL : settings.model;
    const body: Record<string, unknown> = {
      model,
      temperature: 0,
      max_tokens: 2000,
      messages: [
        { role: "system", content: "You classify books into a fixed category list and answer with JSON only." },
        { role: "user", content: buildPrompt(items, categories) }
      ]
    };
    if (settings.jsonMode) {
      body.response_format = { type: "json_object" };
    }
    if (settings.name === "OpenRouter") {
      body.reasoning = { exclude: true };
    }

    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.error(`[categorization] ${settings.name} (${model}) error ${response.status}:`, await response.text().catch(() => ""));
      throw new Error(`The ${settings.name} could not suggest categories right now.`);
    }

    const payload = (await response.json()) as ChatResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error(`The ${settings.name} returned an empty response.`);

    try {
      return parseResults(content);
    } catch (error) {
      console.error(`[categorization] unreadable reply from ${model}:`, content.slice(0, 400));
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }
}

/** Pull the results array out of the model reply, tolerating fenced code blocks. */
function parseResults(content: string): Map<string, string> {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The AI reply could not be read.");
  }

  let parsed: { results?: unknown };
  try {
    parsed = JSON.parse(content.slice(start, end + 1)) as { results?: unknown };
  } catch {
    throw new Error("The AI reply could not be read.");
  }

  const results = Array.isArray(parsed.results) ? (parsed.results as ModelResult[]) : [];
  const byRef = new Map<string, string>();
  for (const result of results) {
    const ref = typeof result?.ref === "string" ? result.ref : String(result?.ref ?? "");
    const category = typeof result?.category === "string" ? result.category.trim() : "";
    if (ref && category) {
      byRef.set(ref, category.slice(0, MAX_NEW_CATEGORY_CHARS));
    }
  }
  return byRef;
}

/**
 * Ask the configured LLM to pick a category for each book. Categories the model
 * invents are added to the curated list and the admins are notified, so a
 * suggestion is always a value the rest of the app can store and filter on.
 *
 * Books the model skips are simply left out of the returned array.
 */
export async function suggestBookCategories(items: CategorizationItem[]): Promise<CategorySuggestion[]> {
  if (!items.length) return [];

  const existing = await Category.find({}, { name: 1 }).sort({ name: 1 }).lean();
  const existingNames = existing.map((category) => category.name);
  // Matching is case/whitespace-insensitive so a model that returns a slightly
  // different spelling still resolves to the curated name instead of creating a
  // near-duplicate category.
  const canonical = new Map(existingNames.map((name) => [name.trim().toLowerCase(), name]));

  const suggestions: CategorySuggestion[] = [];
  const created: string[] = [];

  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    const batch = items.slice(index, index + BATCH_SIZE);
    const byRef = await classifyBatch(batch, existingNames);

    for (const item of batch) {
      const proposed = byRef.get(item.ref);
      if (!proposed) continue;

      const match = canonical.get(proposed.trim().toLowerCase());
      if (match) {
        suggestions.push({ ref: item.ref, category: match, isNew: false });
        continue;
      }

      // A brand-new category: persist it before returning so importing a book
      // with this category cannot fail the "category must exist" check.
      await Category.updateOne({ name: proposed }, { $setOnInsert: { name: proposed } }, { upsert: true });
      canonical.set(proposed.trim().toLowerCase(), proposed);
      existingNames.push(proposed);
      created.push(proposed);
      suggestions.push({ ref: item.ref, category: proposed, isNew: true });
    }
  }

  if (created.length) {
    const unique = [...new Set(created)];
    await notifyAdmins({
      type: "category_suggested",
      title: unique.length === 1 ? "New category suggested by AI" : `${unique.length} new categories suggested by AI`,
      message: `Added to the category list while classifying books: ${unique.join("، ")}. Review or rename them in the library.`,
      href: "/library"
    });
  }

  return suggestions;
}

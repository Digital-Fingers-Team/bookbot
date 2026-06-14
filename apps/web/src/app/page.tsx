"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, Bot, ChevronDown, Loader2, Search, Send, Sparkles } from "lucide-react";
import { askQuestion, ApiClientError } from "@/lib/api";
import type { ChatResponse } from "@/lib/types";
import { EvidenceText } from "@/components/evidence-text";

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState("");
  const [limit, setLimit] = useState(8);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const result = await askQuestion({
        question: question.trim(),
        limit,
        model: model.trim() || undefined
      });
      setResponse(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Chat failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-md border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-white/8 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-moss dark:text-sea">Book-only RAG chat</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-ink dark:text-white">Ask your uploaded books</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink/70 dark:border-white/10 dark:bg-ink/60 dark:text-white/70">
            <Sparkles className="h-4 w-4 text-sea" />
            External knowledge blocked
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a factual question that should be answered from your uploaded PDFs."
            className="min-h-36 w-full resize-y rounded-md border border-line bg-paper p-4 text-base outline-none transition placeholder:text-ink/35 focus:border-sea focus:ring-2 focus:ring-sea/20 dark:border-white/10 dark:bg-ink/70 dark:text-white dark:placeholder:text-white/35"
            maxLength={2000}
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_180px_120px]">
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Optional OpenRouter model"
              className="h-11 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-sea focus:ring-2 focus:ring-sea/20 dark:border-white/10 dark:bg-ink/70 dark:text-white"
            />
            <label className="flex h-11 items-center gap-2 rounded-md border border-line bg-paper px-3 text-sm text-ink/70 dark:border-white/10 dark:bg-ink/70 dark:text-white/70">
              Top chunks
              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="ml-auto bg-transparent font-semibold text-ink outline-none dark:text-white"
              >
                {[5, 8, 10, 12, 15].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white shadow-sm shadow-moss/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ask
            </button>
          </div>
        </form>

        {loading ? (
          <div className="mt-6 flex items-center gap-3 rounded-md border border-sea/30 bg-sea/10 p-4 text-sm font-medium text-sea dark:text-sea">
            <Search className="h-4 w-4 animate-pulse" />
            Searching books...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 flex items-start gap-3 rounded-md border border-copper/30 bg-copper/10 p-4 text-sm text-copper">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {response ? <AnswerPanel response={response} /> : null}
      </section>

      <aside className="rounded-md border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-white/8 sm:p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-moss dark:text-sea" />
          <h2 className="text-base font-semibold text-ink dark:text-white">Runtime guardrails</h2>
        </div>
        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-ink dark:text-white">Retrieval boundary</dt>
            <dd className="mt-1 text-ink/60 dark:text-white/60">Only top-ranked uploaded chunks are sent to the model.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink dark:text-white">No match behavior</dt>
            <dd className="mt-1 text-ink/60 dark:text-white/60">Unsupported questions return the strict not-found response.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink dark:text-white">Evidence</dt>
            <dd className="mt-1 text-ink/60 dark:text-white/60">Every answer includes raw chunks, scores, pages, and keyword highlights.</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function AnswerPanel({ response }: { response: ChatResponse }) {
  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-md border border-line bg-paper p-4 dark:border-white/10 dark:bg-ink/60">
        <h2 className="mb-3 text-sm font-semibold uppercase text-ink/55 dark:text-white/55">Answer</h2>
        <p className="whitespace-pre-wrap text-base leading-7 text-ink dark:text-white">{response.answer}</p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-ink/55 dark:text-white/55">Sources</h2>
        {response.sources.length ? (
          <div className="grid gap-3">
            {response.sources.map((source, index) => (
              <article
                key={`${source.bookName}-${source.pageNumber}-${index}`}
                className="rounded-md border border-line bg-white p-4 dark:border-white/10 dark:bg-white/6"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink dark:text-white">
                  <span>{source.bookName}</span>
                  <span className="rounded bg-moss/10 px-2 py-1 text-xs text-moss dark:bg-sea/15 dark:text-sea">
                    Page {source.pageNumber}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-ink/70 dark:text-white/65">{source.supportingText}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-line bg-paper p-4 text-sm text-ink/60 dark:border-white/10 dark:bg-ink/60 dark:text-white/60">
            No supporting sources were found.
          </p>
        )}
      </section>

      {response.evidence.length ? (
        <details className="rounded-md border border-line bg-white dark:border-white/10 dark:bg-white/6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink dark:text-white">
            Show Evidence
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="space-y-3 border-t border-line p-4 dark:border-white/10">
            {response.evidence.map((chunk) => (
              <article key={chunk.id} className="rounded-md border border-line bg-paper p-4 dark:border-white/10 dark:bg-ink/60">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-ink/55 dark:text-white/55">
                  <span>{chunk.bookName}</span>
                  <span>Page {chunk.pageNumber}</span>
                  <span>Score {chunk.score}</span>
                </div>
                <p className="text-sm leading-6 text-ink/75 dark:text-white/70">
                  <EvidenceText text={chunk.chunkText} highlights={chunk.highlights} />
                </p>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      <p className="text-xs text-ink/50 dark:text-white/45">
        Retrieved {response.usage.retrievedChunks} chunks
        {response.usage.model ? ` with ${response.usage.model}` : ""}.
      </p>
    </div>
  );
}

"use client";

import { type FormEvent, useState } from "react";
import { AlertCircle, BookOpen, ChevronDown, Loader2, Search, Send, ShieldCheck, Sparkles } from "lucide-react";
import { askQuestion, ApiClientError } from "@/lib/api";
import type { ChatResponse } from "@/lib/types";
import { EvidenceText } from "@/components/evidence-text";
import { useAuth } from "@/components/auth-provider";

export default function ChatPage() {
  const { isAdmin } = useAuth();
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
    <div className="space-y-8">
      {!isAdmin ? <LibraryHero /> : null}

      <section className="overflow-hidden border border-line bg-white shadow-soft dark:border-white/10 dark:bg-ink/85">
        <SectionHeader title="Ask your uploaded books" icon={<ShieldCheck className="h-5 w-5" />} />
        <div className="grid gap-8 p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-7">
          <div className="space-y-5">
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink dark:text-white">Question</label>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask about a fact, page, topic, name, or quote from your books."
                  className="min-h-44 w-full resize-y rounded-md border border-line bg-white p-4 text-base leading-7 text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-[#111a14] dark:text-white dark:placeholder:text-white/35"
                  maxLength={2000}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_130px]">
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="Optional OpenRouter model"
                  className="h-11 rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-[#111a14] dark:text-white"
                />
                <label className="flex h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm text-ink/70 dark:border-white/10 dark:bg-[#111a14] dark:text-white/70">
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
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white shadow-sm shadow-moss/20 transition hover:bg-[#064b26] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Ask
                </button>
              </div>
            </form>

            {loading ? (
              <div className="flex items-center gap-3 rounded-md border border-sea/25 bg-sea/10 p-4 text-sm font-medium text-moss dark:text-sea">
                <Search className="h-4 w-4 animate-pulse" />
                Searching the uploaded book chunks...
              </div>
            ) : null}

            {error ? (
              <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            {response ? <AnswerPanel response={response} /> : null}
          </div>

          <aside className="rounded-md border border-line bg-paper p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-moss/10 text-moss dark:bg-sea/10 dark:text-sea">
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="text-base font-semibold text-moss dark:text-white">Answer quality</h2>
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-ink dark:text-white">Search first</dt>
                <dd className="mt-1 text-ink/60 dark:text-white/60">BookBot retrieves matching chunks before asking the model.</dd>
              </div>
              <div>
                <dt className="font-medium text-ink dark:text-white">Cited answers</dt>
                <dd className="mt-1 text-ink/60 dark:text-white/60">Sources and evidence stay visible with every answer.</dd>
              </div>
              <div>
                <dt className="font-medium text-ink dark:text-white">Try exact terms</dt>
                <dd className="mt-1 text-ink/60 dark:text-white/60">Names, headings, and page words work best.</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

    </div>
  );
}

function LibraryHero() {
  const books = [
    ["Governance", "bg-[#e6c766]", "h-44"],
    ["Leadership", "bg-white", "h-52"],
    ["Digital", "bg-[#6aa66d]", "h-56"],
    ["Security", "bg-[#234331] text-white", "h-48"],
    ["Strategy", "bg-[#eee6d3]", "h-60"]
  ];

  return (
    <section className="relative overflow-hidden border-b-[16px] border-moss bg-white shadow-soft">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.96),rgba(255,255,255,0.82)),repeating-linear-gradient(90deg,rgba(7,95,47,0.07)_0,rgba(7,95,47,0.07)_5px,transparent_5px,transparent_44px)]" />
      <div className="relative grid min-h-[310px] items-end gap-8 px-6 py-10 lg:grid-cols-[1fr_0.95fr] lg:px-12">
        <div className="pb-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-copper">AI Book Knowledge Library</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-moss drop-shadow-sm sm:text-5xl lg:text-6xl">
            Ask books. Get cited answers.
          </h1>
          <div className="my-5 h-1 w-full max-w-xl bg-copper" />
          <p className="max-w-2xl text-xl font-semibold leading-relaxed text-ink/75 sm:text-2xl">
            Upload PDFs, search them with hybrid retrieval, and answer only from trusted book evidence.
          </p>
        </div>
        <div className="flex min-h-52 items-end justify-center gap-3">
          {books.map(([title, color, height], index) => (
            <div
              key={title}
              className={`relative w-24 ${height} ${color} flex shrink-0 flex-col justify-between border border-black/10 p-3 text-center shadow-[12px_14px_18px_rgba(0,0,0,0.22)]`}
              style={{ transform: `translateY(${index % 2 ? 12 : 0}px) skewY(-1deg)` }}
            >
              <BookOpen className="mx-auto h-7 w-7 text-moss" />
              <span className="text-xs font-bold leading-5">{title}</span>
              <span className="h-2 bg-moss/70" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-b from-[#74b66f] to-moss px-5 py-4 text-white">
      <h2 className="text-xl font-semibold">{title}</h2>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-moss/45 shadow-inner">{icon}</span>
    </div>
  );
}

function AnswerPanel({ response }: { response: ChatResponse }) {
  const notFound = response.usage.retrievedChunks === 0 || /information not found/i.test(response.answer);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-white dark:border-white/10 dark:bg-[#111a14]">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <h2 className="text-sm font-semibold uppercase text-ink/55 dark:text-white/55">
          {notFound ? "No matching evidence" : "Answer and evidence"}
        </h2>
        <BookOpen className="h-4 w-4 text-moss dark:text-sea" />
      </div>
      <div className="space-y-5 p-4">
        <div className="rounded-md border border-line bg-paper p-5 dark:border-white/10 dark:bg-white/5">
          <h2 className="mb-3 text-sm font-semibold uppercase text-ink/55 dark:text-white/55">
            {notFound ? "What happened" : "Answer"}
          </h2>
          <p className="whitespace-pre-wrap text-base leading-7 text-ink dark:text-white">
            {notFound
              ? "I could not find matching evidence in the uploaded books. Try a more specific phrase, a name from the book, or increase the chunk count."
              : response.answer.replace(/^Answer:\s*/i, "")}
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase text-ink/55 dark:text-white/55">Sources</h2>
          {response.sources.length ? (
            <div className="grid gap-3">
              {response.sources.map((source, index) => (
                <article key={`${source.bookName}-${source.pageNumber}-${index}`} className="rounded-md border border-line bg-white p-4 dark:border-white/10 dark:bg-[#111a14]">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink dark:text-white">
                    <span>{source.bookName}</span>
                    <span className="rounded bg-moss/10 px-2 py-1 text-xs text-moss">Page {source.pageNumber}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink/70 dark:text-white/70">{source.supportingText}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-line bg-paper p-4 text-sm text-ink/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60">No supporting sources were found.</p>
          )}
        </div>

        {response.evidence.length ? (
          <details className="rounded-md border border-line bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
              Show Evidence
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="space-y-3 border-t border-line p-4">
              {response.evidence.map((chunk) => (
                <article key={chunk.id} className="rounded-md border border-line bg-paper p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-ink/55">
                    <span>{chunk.bookName}</span>
                    <span>Page {chunk.pageNumber}</span>
                    <span>Score {chunk.score}</span>
                  </div>
                  <p className="text-sm leading-6 text-ink/75">
                    <EvidenceText text={chunk.chunkText} highlights={chunk.highlights} />
                  </p>
                </article>
              ))}
            </div>
          </details>
        ) : null}

        <p className="text-xs text-ink/50">
          Retrieved {response.usage.retrievedChunks} chunks
          {response.usage.model ? ` with ${response.usage.model}` : ""}.
        </p>
      </div>
    </div>
  );
}

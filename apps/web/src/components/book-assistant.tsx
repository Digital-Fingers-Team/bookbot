"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Search, Send, Sparkles, Trash2 } from "lucide-react";
import { getBookConversation, saveBookConversation, streamQuestion } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import type { Source } from "@/lib/types";
import { useT } from "@/lib/i18n";

const RESPONSE_DEPTH = 3;

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  status: "searching" | "streaming" | "done" | "error";
};

export function BookAssistant({ bookId, onJumpToPage }: { bookId: string; onJumpToPage: (page: number) => void }) {
  const t = useT();
  const { token } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Remember this book's conversation per account (synced via the server).
  useEffect(() => {
    if (!token) {
      return;
    }
    setLoaded(false);
    getBookConversation(bookId, token)
      .then((result) =>
        setMessages(
          result.messages.map((message) => ({
            id: crypto.randomUUID(),
            role: message.role,
            content: message.content,
            sources: (message.sources ?? []).map((source) => ({
              bookId: source.bookId,
              bookName: source.bookName ?? "",
              pageNumber: source.pageNumber ?? 0,
              supportingText: source.supportingText ?? ""
            })),
            status: "done"
          }))
        )
      )
      .catch(() => setMessages([]))
      .finally(() => setLoaded(true));
  }, [bookId, token]);

  // Persist once a turn finishes (not on every streamed token).
  useEffect(() => {
    if (!loaded || busy || !token) {
      return;
    }
    void saveBookConversation(
      bookId,
      messages.map((message) => ({
        role: message.role,
        content: message.content,
        sources: message.role === "assistant" ? message.sources : []
      })),
      token
    ).catch(() => undefined);
  }, [messages, busy, loaded, token, bookId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function clearChat() {
    setMessages([]);
  }

  function patch(id: string, update: (message: Msg) => Msg) {
    setMessages((prev) => prev.map((message) => (message.id === id ? update(message) : message)));
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const question = input.trim();
    if (!question || busy) {
      return;
    }

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: question, sources: [], status: "done" },
      { id: assistantId, role: "assistant", content: "", sources: [], status: "searching" }
    ]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamQuestion(
        { question, limit: RESPONSE_DEPTH, bookId },
        {
          signal: controller.signal,
          onMeta: (meta) => patch(assistantId, (message) => ({ ...message, sources: meta.sources ?? [], status: "streaming" })),
          onToken: (delta) => patch(assistantId, (message) => ({ ...message, content: message.content + delta, status: "streaming" })),
          onDone: (done) => patch(assistantId, (message) => ({ ...message, content: message.content || done.answer, status: "done" })),
          onError: (error) => patch(assistantId, (message) => ({ ...message, status: "error", content: message.content || error.message }))
        }
      );
    } finally {
      abortRef.current = null;
      setBusy(false);
      patch(assistantId, (message) =>
        message.status === "searching" || message.status === "streaming" ? { ...message, status: "done" } : message
      );
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0c0c0e]">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 dark:border-white/10">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
          <Sparkles className="h-4 w-4 text-moss dark:text-sea" />
          {t("read.askTitle")}
        </span>
        {messages.length ? (
          <button
            type="button"
            onClick={clearChat}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink/45 transition hover:text-red-600 dark:text-white/45 dark:hover:text-red-300"
            title={t("read.clearChat")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("read.clearChat")}
          </button>
        ) : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="mx-auto mt-6 max-w-xs text-center text-sm leading-6 text-ink/45 dark:text-white/45">
            {t("read.askEmpty")}
          </p>
        ) : (
          messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-start ltr:justify-end">
                <div
                  dir="auto"
                  className="book-text max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-moss px-3.5 py-2 text-sm text-white dark:bg-sea/90"
                >
                  {message.content}
                </div>
              </div>
            ) : (
              <div key={message.id} className="space-y-2">
                <div className="rounded-2xl rounded-tl-sm border border-line bg-paper p-3 dark:border-white/10 dark:bg-white/5">
                  {message.status === "searching" ? (
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-moss dark:text-sea">
                      <Search className="h-4 w-4 animate-pulse" />
                      {t("ask.searching")}
                    </span>
                  ) : (
                    <p dir="auto" className="book-text whitespace-pre-wrap text-sm text-ink dark:text-white">
                      <InlineMarkdown text={message.content} />
                    </p>
                  )}
                </div>
                {message.sources.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {message.sources.map((source, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => onJumpToPage(source.pageNumber)}
                        title={`${t("read.goToPage")} ${source.pageNumber}`}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-moss transition hover:border-moss/40 hover:bg-moss/5 dark:border-white/10 dark:bg-white/5 dark:text-sea dark:hover:border-sea/40"
                      >
                        <FileText className="h-3 w-3" />
                        {t("ask.page")} {source.pageNumber}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          )
        )}
      </div>

      <form onSubmit={send} className="border-t border-line p-3 dark:border-white/10">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-paper p-1.5 transition focus-within:border-moss focus-within:ring-2 focus-within:ring-moss/15 dark:border-white/10 dark:bg-white/5">
          <textarea
            value={input}
            dir="auto"
            rows={1}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("read.askPlaceholder")}
            className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-ink outline-none placeholder:text-ink/35 dark:text-white dark:placeholder:text-white/35"
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-moss text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t("ask.title")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+?\*\*)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={index} className="font-bold">
              {part.slice(2, -2)}
            </strong>
          );
        }

        return part;
      })}
    </>
  );
}

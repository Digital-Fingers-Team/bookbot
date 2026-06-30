"use client";

import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  HelpCircle,
  Loader2,
  History,
  MessageSquareText,
  Plus,
  Printer,
  Quote,
  Search,
  Send,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X
} from "lucide-react";
import Link from "next/link";
import {
  ApiClientError,
  type ConversationSummary,
  createConversation,
  deleteConversation,
  getBookPdf,
  getConversation,
  getMyBooks,
  listConversations,
  type MyBook,
  sendFeedback,
  type StoredMessage,
  streamQuestion,
  type StreamMeta,
  updateConversation
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import type { EvidenceChunk, Source } from "@/lib/types";
import { EvidenceText } from "@/components/evidence-text";
import { answerOverlapHighlights, citeSentences } from "@/lib/highlight";
import { Landing } from "@/components/landing";
import { DiscoveryExperience } from "@/components/discovery-experience";
import { useLang, useT } from "@/lib/i18n";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  evidence: EvidenceChunk[];
  status: "searching" | "streaming" | "done" | "error";
  usage?: { retrievedChunks?: number; model?: string };
};

const EXAMPLES = ["ما هو مفهوم القيادة؟", "ما الفرق بين الإدارة والقيادة؟", "اذكر أهمية القيادة الإدارية"];

const RESPONSE_DEPTH = 3;

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink/40 dark:text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // Visitors get the marketing landing; signed-in accounts go straight to chat.
  if (!user) {
    return <Landing />;
  }

  // Users without library access get the discovery guide until an admin grants
  // them a book or category; admins and granted users get the full chat.
  if (user.hasAccess === false) {
    return <DiscoveryExperience />;
  }

  return <ChatExperience />;
}

function ChatExperience() {
  const { token } = useAuth();
  const t = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stick, setStick] = useState(true);

  const [reader, setReader] = useState<{ bookName: string; page: number } | null>(null);
  const [readerUrl, setReaderUrl] = useState("");
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState("");

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastRead, setLastRead] = useState<MyBook | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  useEffect(() => {
    if (stick && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, stick]);

  const refreshConversations = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const result = await listConversations(token);
      setConversations(result.conversations);
    } catch {
      // History is best-effort; ignore transient failures.
    }
  }, [token]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // The most recently opened book, for the "continue reading" shortcut.
  useEffect(() => {
    if (!token) {
      return;
    }
    getMyBooks(token)
      .then((result) => setLastRead(result.continueReading[0] ?? null))
      .catch(() => undefined);
  }, [token]);

  // Persist the conversation whenever a turn finishes (busy returns to false).
  useEffect(() => {
    if (busy || !token) {
      return;
    }
    const hasAnswer = messages.some((message) => message.role === "assistant" && message.status === "done" && message.content);
    if (!hasAnswer) {
      return;
    }

    const stored: StoredMessage[] = messages
      .filter((message) => message.content)
      .map((message) => ({
        role: message.role,
        content: message.content,
        sources:
          message.role === "assistant"
            ? message.sources.map((source) => ({
                bookId: source.bookId,
                bookName: source.bookName,
                pageNumber: source.pageNumber,
                supportingText: source.supportingText
              }))
            : []
      }));

    if (!stored.length) {
      return;
    }

    (async () => {
      try {
        if (conversationIdRef.current) {
          await updateConversation(conversationIdRef.current, { messages: stored }, token);
        } else {
          const created = await createConversation({ messages: stored }, token);
          setConversationId(created.id);
        }
        await refreshConversations();
      } catch {
        // Saving history is best-effort and must never break the chat.
      }
    })();
    // Intentionally keyed on `busy` so we save once per finished turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  async function openConversation(id: string) {
    if (!token || busy) {
      return;
    }
    abortRef.current?.abort();
    setHistoryOpen(false);
    try {
      const conversation = await getConversation(id, token);
      setMessages(
        conversation.messages.map((message) => ({
          id: crypto.randomUUID(),
          role: message.role,
          content: message.content,
          sources: (message.sources ?? []).map((source) => ({
            bookId: source.bookId,
            bookName: source.bookName ?? "",
            pageNumber: source.pageNumber ?? 0,
            supportingText: source.supportingText ?? ""
          })),
          evidence: [],
          status: "done"
        }))
      );
      setConversationId(id);
      setStick(true);
    } catch {
      // ignore load failure
    }
  }

  async function removeConversation(id: string) {
    if (!token) {
      return;
    }
    try {
      await deleteConversation(id, token);
      if (conversationId === id) {
        setMessages([]);
        setConversationId(null);
      }
      await refreshConversations();
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    return () => {
      if (readerUrl) {
        URL.revokeObjectURL(readerUrl);
      }
    };
  }, [readerUrl]);

  async function openSource(source: Source) {
    if (!source.bookId) {
      return;
    }

    if (readerUrl) {
      URL.revokeObjectURL(readerUrl);
    }
    setReader({ bookName: source.bookName, page: source.pageNumber });
    setReaderUrl("");
    setReaderError("");
    setReaderLoading(true);

    try {
      const blob = await getBookPdf(source.bookId, token);
      setReaderUrl(URL.createObjectURL(blob));
    } catch (error) {
      setReaderError(error instanceof ApiClientError ? error.message : t("ask.openFailed"));
    } finally {
      setReaderLoading(false);
    }
  }

  function closeReader() {
    if (readerUrl) {
      URL.revokeObjectURL(readerUrl);
    }
    setReader(null);
    setReaderUrl("");
    setReaderError("");
    setReaderLoading(false);
  }

  function patch(id: string, update: (message: ChatMessage) => ChatMessage) {
    setMessages((prev) => prev.map((message) => (message.id === id ? update(message) : message)));
  }

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || busy) {
      return;
    }

    // Recent turns (before this one) so follow-up questions keep context.
    const history = messages
      .filter((message) => message.content && (message.role === "user" || message.status === "done"))
      .slice(-6)
      .map((message) => ({ role: message.role, content: message.content }));

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: question, sources: [], evidence: [], status: "done" },
      { id: assistantId, role: "assistant", content: "", sources: [], evidence: [], status: "searching" }
    ]);
    setInput("");
    resetTextarea();
    setBusy(true);
    setStick(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamQuestion(
        { question, limit: RESPONSE_DEPTH, history },
        {
          signal: controller.signal,
          onMeta: (meta: StreamMeta) =>
            patch(assistantId, (message) => ({
              ...message,
              sources: meta.sources ?? [],
              evidence: meta.evidence ?? [],
              status: "streaming",
              usage: { ...message.usage, retrievedChunks: meta.usage?.retrievedChunks }
            })),
          onToken: (delta) =>
            patch(assistantId, (message) => ({ ...message, content: message.content + delta, status: "streaming" })),
          onDone: (done) =>
            patch(assistantId, (message) => ({
              ...message,
              content: message.content || done.answer,
              status: "done",
              usage: { retrievedChunks: done.usage?.retrievedChunks ?? message.usage?.retrievedChunks, model: done.usage?.model }
            })),
          onError: (error) =>
            patch(assistantId, (message) => ({ ...message, status: "error", content: message.content || error.message }))
        },
        token
      );
    } finally {
      abortRef.current = null;
      setBusy(false);
      patch(assistantId, (message) =>
        message.status === "searching" || message.status === "streaming" ? { ...message, status: "done" } : message
      );
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setInput("");
    resetTextarea();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  function resetTextarea() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
    }
  }

  function autoResize() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }

  return (
    <section className="relative flex h-[calc(100dvh-10rem)] min-h-[30rem] flex-col overflow-hidden rounded-xl border border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#0c0c0e] lg:h-[calc(100dvh-6rem)]">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5 dark:border-white/10 sm:gap-3 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
            <MessageSquareText className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[0.95rem] font-semibold text-ink dark:text-white">{t("ask.title")}</h1>
            <p className="truncate text-xs text-ink/45 dark:text-white/45">{t("ask.subtitle")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <HelpButton />
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-sea"
            title={t("ask.history")}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">{t("ask.history")}</span>
          </button>
          {messages.length ? (
            <button
              type="button"
              onClick={newChat}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-sea"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("ask.newChat")}</span>
            </button>
          ) : null}
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-5 sm:px-5">
        {messages.length === 0 ? (
          <EmptyState onPick={(prompt) => send(prompt)} disabled={busy} lastRead={lastRead} />
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            {messages.map((message) =>
              message.role === "user" ? (
                <UserBubble key={message.id} message={message} />
              ) : (
                <AssistantBubble key={message.id} message={message} onOpenSource={openSource} />
              )
            )}
          </div>
        )}
      </div>

      <Composer
        input={input}
        busy={busy}
        textareaRef={textareaRef}
        onChange={(value) => {
          setInput(value);
          autoResize();
        }}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        onStop={stop}
      />

      {reader ? (
        <BookReader
          bookName={reader.bookName}
          page={reader.page}
          url={readerUrl}
          loading={readerLoading}
          error={readerError}
          onClose={closeReader}
        />
      ) : null}

      {historyOpen ? (
        <HistoryDrawer
          conversations={conversations}
          activeId={conversationId}
          onClose={() => setHistoryOpen(false)}
          onOpen={openConversation}
          onDelete={removeConversation}
          onNew={() => {
            newChat();
            setHistoryOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

function HistoryDrawer({
  conversations,
  activeId,
  onClose,
  onOpen,
  onDelete,
  onNew
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const t = useT();

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 flex" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("ask.history")}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <aside
        className="relative ms-auto flex h-full w-full max-w-xs flex-col border-s border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#0c0c0e]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 dark:border-white/10">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
            <History className="h-4 w-4" />
            {t("ask.history")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 transition hover:bg-ink/5 hover:text-ink dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={t("ask.closeReader")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="m-3 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-line bg-white text-sm font-medium text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-sea"
        >
          <Plus className="h-4 w-4" />
          {t("ask.newChat")}
        </button>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {conversations.length ? (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group/conv flex items-center gap-1 rounded-lg pe-1 transition ${
                  activeId === conversation.id
                    ? "bg-moss/[0.08] dark:bg-sea/15"
                    : "hover:bg-ink/[0.04] dark:hover:bg-white/5"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(conversation.id)}
                  className="min-w-0 flex-1 truncate px-2.5 py-2.5 text-start text-sm text-ink/80 dark:text-white/80"
                  dir="auto"
                  title={conversation.title}
                >
                  {conversation.title}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t("ask.deleteChatConfirm"))) {
                      onDelete(conversation.id);
                    }
                  }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink/30 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover/conv:opacity-100 dark:text-white/30 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  aria-label={t("ask.deleteChat")}
                  title={t("ask.deleteChat")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          ) : (
            <p className="px-3 py-8 text-center text-sm text-ink/45 dark:text-white/45">{t("ask.noHistory")}</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function BookReader({
  bookName,
  page,
  url,
  loading,
  error,
  onClose
}: {
  bookName: string;
  page: number;
  url: string;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={bookName}
    >
      <div
        className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#0c0c0e]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink dark:text-white">{bookName}</h2>
            <p className="truncate text-xs text-ink/45 dark:text-white/45">
              {t("ask.openedAtPage")} {page}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:text-white/70 dark:hover:text-sea"
            aria-label={t("ask.closeReader")}
            title={t("ask.closeReader")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 bg-paper dark:bg-[#08080a]">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-ink/60 dark:text-white/60">
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t("ask.opening")}
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                <AlertCircle className="mx-auto mb-2 h-5 w-5" />
                {error}
              </div>
            </div>
          ) : url ? (
            <iframe src={`${url}#page=${page}`} title={bookName} className="h-full w-full bg-white" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
  lastRead
}: {
  onPick: (prompt: string) => void;
  disabled: boolean;
  lastRead: MyBook | null;
}) {
  const t = useT();
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-moss/15 bg-moss/10 text-moss dark:border-sea/25 dark:bg-sea/10 dark:text-sea">
        <BookOpen className="h-8 w-8" />
      </span>
      <h2 className="mt-5 text-2xl font-bold text-moss dark:text-white">{t("ask.emptyTitle")}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink/60 dark:text-white/60">{t("ask.emptyBody")}</p>

      {lastRead ? (
        <Link
          href={`/read/${lastRead.id}`}
          className="mt-6 flex w-full items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-start transition hover:border-moss/40 hover:bg-moss/5 dark:border-white/10 dark:bg-white/5 dark:hover:border-sea/40"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-ink/45 dark:text-white/45">{t("mb.continueReading")}</span>
            <span dir="auto" className="block truncate text-sm font-semibold text-ink dark:text-white">{lastRead.title}</span>
          </span>
          <span className="shrink-0 text-xs font-medium text-moss dark:text-sea">
            {t("ask.page")} {lastRead.lastPage}
          </span>
        </Link>
      ) : null}
      <div className="mt-7 grid w-full gap-2.5 sm:grid-cols-1">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            disabled={disabled}
            onClick={() => onPick(example)}
            dir="auto"
            className="group flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-start text-sm font-medium text-ink transition hover:border-moss/40 hover:bg-moss/5 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-sea/40"
          >
            <span className="book-text">{example}</span>
            <Send className="h-4 w-4 shrink-0 text-ink/30 transition group-hover:text-moss dark:text-white/30 dark:group-hover:text-sea" />
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-start ltr:justify-end">
      <div
        dir="auto"
        className="book-text max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-moss px-4 py-2.5 text-[0.95rem] text-white shadow-sm dark:bg-sea/90"
      >
        {message.content}
      </div>
    </div>
  );
}

function CitedAnswer({
  text,
  sources,
  onOpenSource
}: {
  text: string;
  sources: Source[];
  onOpenSource: (source: Source) => void;
}) {
  const t = useT();
  const segments = citeSentences(text, sources);

  return (
    <>
      {segments.map((segment, index) => {
        const source = segment.source !== null ? sources[segment.source] : undefined;
        return (
          <span key={index}>
            <InlineMarkdown text={segment.text} />
            {source ? (
              <button
                type="button"
                onClick={() => onOpenSource(source)}
                className="mx-0.5 inline-flex items-center rounded bg-moss/10 px-1 align-super text-[0.62em] font-bold text-moss transition hover:bg-moss/20 dark:bg-sea/15 dark:text-sea dark:hover:bg-sea/25"
                title={`${t("ask.openAtPage")} ${source.pageNumber}`}
              >
                {(segment.source as number) + 1}
              </button>
            ) : null}
          </span>
        );
      })}
    </>
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

function AssistantBubble({ message, onOpenSource }: { message: ChatMessage; onOpenSource: (source: Source) => void }) {
  const t = useT();
  const searching = message.status === "searching";
  const streaming = message.status === "streaming";
  const failed = message.status === "error";
  // Normal chat: the reply streams in as a comfortably wide bubble. Once it is done
  // the evidence slides in from the left and sits in a column beside the reply.
  const showEvidence = message.status === "done" && (message.sources.length > 0 || message.evidence.length > 0);

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
        <Sparkles className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-4 sm:flex-row-reverse sm:items-start">
          <div
            className={`min-w-0 flex-1 rounded-2xl rounded-tl-sm border p-4 ${
              failed
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                : "border-line bg-paper dark:border-white/10 dark:bg-white/5"
            }`}
          >
            {searching ? (
              <Thinking />
            ) : (
              <>
                <div
                  dir="auto"
                  aria-live="polite"
                  className="book-text whitespace-pre-wrap text-[0.97rem] text-ink dark:text-white"
                >
                  {failed ? <AlertCircle className="me-1.5 inline h-4 w-4 align-text-bottom" /> : null}
                  {message.status === "done" && message.sources.length && !failed ? (
                    <CitedAnswer text={message.content} sources={message.sources} onOpenSource={onOpenSource} />
                  ) : (
                    <InlineMarkdown text={message.content} />
                  )}
                  {streaming ? <span className="ms-0.5 inline-block h-4 w-[2px] animate-pulse bg-moss align-middle dark:bg-sea" /> : null}
                </div>

                {message.status === "done" && message.content ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3 dark:border-white/10">
                    <CopyButton text={message.content} />
                    <PrintButton message={message} />
                    <Feedback answer={message.content} />
                    {message.usage?.retrievedChunks ? (
                      <MetaChip>
                        {message.usage.retrievedChunks} {t("ask.chunks")}
                      </MetaChip>
                    ) : null}
                    {message.usage?.model ? <MetaChip>{message.usage.model}</MetaChip> : null}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {showEvidence ? (
            <aside className="w-full animate-slide-in-left sm:sticky sm:top-3 sm:w-72 sm:shrink-0 sm:self-start">
              <Evidence
                sources={message.sources}
                evidence={message.evidence}
                answer={message.content}
                onOpenSource={onOpenSource}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Thinking() {
  const t = useT();
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-moss dark:text-sea">
      <Search className="h-4 w-4 animate-pulse" />
      {t("ask.searching")}
      <span className="flex gap-1">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </span>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-moss/60 dark:bg-sea/60" style={{ animationDelay: delay }} />;
}

function Evidence({
  sources,
  evidence,
  answer,
  onOpenSource
}: {
  sources: Source[];
  evidence: EvidenceChunk[];
  answer: string;
  onOpenSource: (source: Source) => void;
}) {
  const t = useT();
  if (!sources.length && !evidence.length) {
    return null;
  }

  return (
    <details
      className="group rounded-xl border border-line bg-white dark:border-white/10 dark:bg-[#0c0c0e]"
      open={sources.length > 0}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold text-ink transition hover:text-moss dark:text-white dark:hover:text-sea">
        <span className="flex items-center gap-2">
          <Quote className="h-4 w-4" />
          {t("ask.evidence")}
          <span className="rounded-full bg-moss/10 px-2 py-0.5 text-xs font-bold text-moss dark:bg-sea/15 dark:text-sea">
            {Math.max(sources.length, evidence.length)}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto overscroll-contain border-t border-line p-3 dark:border-white/10">
        {sources.map((source, index) => {
          const canOpen = Boolean(source.bookId);
          return (
            <article
              key={`${source.bookName}-${source.pageNumber}-${index}`}
              style={{ animationDelay: `${index * 90}ms` }}
              role={canOpen ? "button" : undefined}
              tabIndex={canOpen ? 0 : undefined}
              onClick={canOpen ? () => onOpenSource(source) : undefined}
              onKeyDown={
                canOpen
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenSource(source);
                      }
                    }
                  : undefined
              }
              title={canOpen ? `Open ${source.bookName} at page ${source.pageNumber}` : undefined}
              className={`group/src animate-fade-in rounded-lg border border-line bg-paper p-3.5 dark:border-white/10 dark:bg-white/5 ${
                canOpen
                  ? "cursor-pointer transition hover:border-moss/40 hover:bg-moss/[0.04] focus:outline-none focus:ring-2 focus:ring-moss/25 dark:hover:border-sea/40"
                  : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-moss/10 text-[11px] font-bold text-moss dark:bg-sea/15 dark:text-sea">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink dark:text-white">{source.bookName}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-moss/10 px-2 py-0.5 text-xs font-semibold text-moss dark:bg-sea/15 dark:text-sea">
                  <FileText className="h-3 w-3" />
                  {t("ask.page")} {source.pageNumber}
                </span>
              </div>
              {source.supportingText ? (
                <p dir="auto" className="book-text mt-2 border-t border-line/70 pt-2 text-sm text-ink/70 dark:border-white/10 dark:text-white/70">
                  <EvidenceText text={source.supportingText} highlights={answerOverlapHighlights(source.supportingText, answer)} tone="answer" />
                </p>
              ) : null}
              {canOpen ? (
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-moss opacity-0 transition group-hover/src:opacity-100 dark:text-sea">
                  <ExternalLink className="h-3 w-3" />
                  {t("ask.openAtPage")} {source.pageNumber}
                </span>
              ) : null}
            </article>
          );
        })}

        {evidence.length ? (
          <details className="group/ev rounded-lg border border-dashed border-line dark:border-white/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink/55 dark:text-white/55">
              {t("ask.rawChunks")} ({evidence.length})
              <ChevronDown className="h-3.5 w-3.5 transition group-open/ev:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-line p-3 dark:border-white/10">
              {evidence.map((chunk) => (
                <div key={chunk.id} className="rounded-md bg-paper p-3 dark:bg-white/5">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-ink/55 dark:text-white/55">
                    <span className="truncate uppercase">{chunk.bookName}</span>
                    <span className="text-ink/30 dark:text-white/30">·</span>
                    <span>
                      {t("ask.page")} {chunk.pageNumber}
                    </span>
                    <span className="ms-auto rounded-full bg-moss/10 px-2 py-0.5 font-bold text-moss dark:bg-sea/15 dark:text-sea">
                      {scorePercent(chunk.score)} {t("ask.match")}
                    </span>
                  </div>
                  <p dir="auto" className="book-text text-sm text-ink/75 dark:text-white/75">
                    <EvidenceText text={chunk.chunkText} highlights={chunk.highlights} />
                  </p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function Composer({
  input,
  busy,
  textareaRef,
  onChange,
  onSubmit,
  onKeyDown,
  onStop
}: {
  input: string;
  busy: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
}) {
  const t = useT();
  return (
    <div className="border-t border-line bg-white px-3 py-3 dark:border-white/10 dark:bg-[#0c0c0e] sm:px-5">
      <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-paper p-2 transition focus-within:border-moss focus-within:ring-2 focus-within:ring-moss/15 dark:border-white/10 dark:bg-white/5">
          <textarea
            ref={textareaRef}
            value={input}
            dir="auto"
            rows={1}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("ask.placeholder")}
            className="max-h-[200px] min-h-[2.75rem] flex-1 resize-none bg-transparent px-2 py-2 text-[0.97rem] leading-7 text-ink outline-none placeholder:text-ink/35 dark:text-white dark:placeholder:text-white/35"
            maxLength={2000}
          />
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink/70 transition hover:border-moss hover:text-moss dark:border-white/10 dark:bg-white/10 dark:text-white/70"
              title="Stop generating"
              aria-label="Stop generating"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-moss text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-40"
              title="Send"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-ink/45 dark:text-white/45">
          <span className="hidden sm:inline">
            <kbd className="rounded border border-line px-1 font-sans dark:border-white/15">Enter</kbd> {t("ask.enterToSend")}{" "}
            · <kbd className="rounded border border-line px-1 font-sans dark:border-white/15">Shift</kbd>+
            <kbd className="rounded border border-line px-1 font-sans dark:border-white/15">Enter</kbd> {t("ask.shiftEnter")}
          </span>
          {busy ? <Loader2 className="ms-auto h-3.5 w-3.5 animate-spin text-moss dark:text-sea" /> : null}
        </div>
      </form>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink/65 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:text-sea"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-moss dark:text-sea" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? t("ask.copied") : t("ask.copy")}
    </button>
  );
}

function PrintButton({ message }: { message: ChatMessage }) {
  const { t, lang } = useLang();

  function exportPdf() {
    const dir = lang === "ar" ? "rtl" : "ltr";
    const esc = (value: string) =>
      value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] as string);

    const sources = message.sources
      .map(
        (source, index) =>
          `<li><span class="n">[${index + 1}]</span> <b>${esc(source.bookName)}</b> — ${esc(t("ask.page"))} ${source.pageNumber}${
            source.supportingText ? `<div class="src">${esc(source.supportingText)}</div>` : ""
          }</li>`
      )
      .join("");

    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) {
      return;
    }
    win.document.write(
      `<!doctype html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8"><title>${esc(t("brand.orgShort"))}</title><style>` +
        "body{font-family:'Cairo','Segoe UI',system-ui,Tahoma,sans-serif;color:#1c2227;margin:40px;line-height:1.9}" +
        ".org{font-size:13px;color:#0a6b37;font-weight:700;margin-bottom:18px}" +
        ".answer{font-size:15px;white-space:pre-wrap;border-inline-start:3px solid #0a6b37;padding-inline-start:14px}" +
        "h3{font-size:13px;margin-top:28px;color:#555;text-transform:uppercase;letter-spacing:.04em}" +
        "ol{padding-inline-start:18px}li{margin-bottom:10px;font-size:13px}" +
        ".n{color:#0a6b37;font-weight:700}.src{color:#555;font-size:12px;margin-top:4px}" +
        "@media print{body{margin:24px}}" +
        `</style></head><body><div class="org">${esc(t("brand.org"))}</div>` +
        `<div class="answer">${esc(message.content)}</div>` +
        (sources ? `<h3>${esc(t("ask.evidence"))}</h3><ol>${sources}</ol>` : "") +
        "</body></html>"
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  }

  return (
    <button
      type="button"
      onClick={exportPdf}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink/65 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:text-sea"
    >
      <Printer className="h-3.5 w-3.5" />
      {t("ask.print")}
    </button>
  );
}

function HelpButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const steps = [t("ask.howStep1"), t("ask.howStep2"), t("ask.howStep3"), t("ask.howStep4")];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-sea"
        title={t("ask.howTitle")}
        aria-label={t("ask.howTitle")}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("ask.howTitle")}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
          <div
            className="relative w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#0c0c0e]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink dark:text-white">
                <HelpCircle className="h-5 w-5 text-moss dark:text-sea" />
                {t("ask.howTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 transition hover:bg-ink/5 hover:text-ink dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label={t("ask.gotIt")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3">
              {steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-moss/10 text-xs font-bold text-moss dark:bg-sea/15 dark:text-sea">
                    {index + 1}
                  </span>
                  <span dir="auto" className="text-sm leading-6 text-ink/75 dark:text-white/75">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-moss text-sm font-medium text-white transition hover:bg-moss/90"
            >
              {t("ask.gotIt")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Feedback({ answer }: { answer: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "report" | "done">("idle");
  const [note, setNote] = useState("");

  function submit(vote: "up" | "down", reportNote?: string) {
    setState("done");
    void sendFeedback({ vote, note: reportNote, answer: answer.slice(0, 2000) }).catch(() => undefined);
  }

  if (state === "done") {
    return <span className="text-xs font-medium text-moss dark:text-sea">{t("ask.feedbackThanks")}</span>;
  }

  if (state === "report") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("ask.reportPlaceholder")}
          aria-label={t("ask.reportPlaceholder")}
          maxLength={1000}
          className="h-7 w-44 rounded-md border border-line bg-white px-2 text-xs text-ink outline-none focus:border-moss dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <button
          type="button"
          onClick={() => submit("down", note.trim() || undefined)}
          className="inline-flex h-7 items-center rounded-md bg-moss px-2.5 text-xs font-semibold text-white transition hover:bg-moss/90"
        >
          {t("ask.send")}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-ink/45 dark:text-white/45">{t("ask.helpful")}</span>
      <button
        type="button"
        onClick={() => submit("up")}
        aria-label={t("an.helpfulVotes")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink/50 transition hover:bg-moss/10 hover:text-moss dark:text-white/50 dark:hover:bg-sea/15 dark:hover:text-sea"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setState("report")}
        aria-label={t("an.notHelpfulVotes")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink/50 transition hover:bg-red-50 hover:text-red-600 dark:text-white/50 dark:hover:bg-red-500/10 dark:hover:text-red-300"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink/55 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
      {children}
    </span>
  );
}

function scorePercent(score: number) {
  const value = score > 1 ? score / 100 : score;
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

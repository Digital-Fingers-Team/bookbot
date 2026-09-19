"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Lock,
  MessagesSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  X
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/components/auth-provider";
import { buttonClass } from "@/components/ui/button";
import {
  SUPPORT_TOPICS,
  createSupportThread,
  fetchSupportAttachmentUrl,
  sendSupportMessage,
  setSupportThreadStatus,
  type SupportAttachment,
  type SupportMessage,
  type SupportThread,
  type SupportThreadFilters,
  type SupportTopic
} from "@/lib/api";
import { useSupportThread, useSupportThreads } from "@/lib/hooks";
import { useErrorText, useLang } from "@/lib/i18n";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,.docx,.xlsx";

type AdminView = "needsReply" | "open" | "closed" | "all";

const ADMIN_VIEWS: Record<AdminView, SupportThreadFilters> = {
  needsReply: { needsReply: true },
  open: { status: "open" },
  closed: { status: "closed" },
  all: {}
};

/**
 * The whole "contact us" surface, for both sides of the conversation. A reader
 * sees their own threads and can start new ones; an admin sees every thread and
 * replies in place. Keeping it in one component is what keeps the two views
 * from drifting apart — the only differences are the filters and who may write
 * first.
 */
export function SupportInbox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  // Only an admin granted "support" answers on the organization's behalf;
  // any other account sees this page as their own conversation list.
  const isAdmin = useAuth().can("support");
  const { t } = useLang();

  const [view, setView] = useState<AdminView>("needsReply");
  const [search, setSearch] = useState("");
  const query = useDebounced(search, 300);
  const [composing, setComposing] = useState(false);

  const filters = useMemo<SupportThreadFilters>(
    () => (isAdmin ? { ...ADMIN_VIEWS[view], ...(query ? { q: query } : {}) } : {}),
    [isAdmin, view, query]
  );
  const threadsQuery = useSupportThreads(filters);
  const threads = threadsQuery.data?.threads ?? [];

  // The selected thread lives in the URL so an admin notification can deep-link
  // straight into the conversation it is about.
  const selectedId = searchParams.get("thread");
  const select = useCallback(
    (id: string | null) => {
      setComposing(false);
      router.replace(id ? `/support?thread=${id}` : "/support", { scroll: false });
    },
    [router]
  );

  const threadQuery = useSupportThread(selectedId);

  // Opening a thread clears its unread counter server-side, so the list row and
  // the nav badge both need to catch up.
  const openedId = threadQuery.data?.thread.id;
  useEffect(() => {
    if (!openedId) return;
    queryClient.invalidateQueries({ queryKey: ["support-threads"] });
    queryClient.invalidateQueries({ queryKey: ["support-unread"] });
  }, [openedId, queryClient]);

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["support-threads"] });
    queryClient.invalidateQueries({ queryKey: ["support-thread"] });
    queryClient.invalidateQueries({ queryKey: ["support-unread"] });
  }, [queryClient]);

  const showDetail = composing || Boolean(selectedId);

  return (
    <div className="py-2">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-5 w-5 text-moss dark:text-sea" />
          <div>
            <h1 className="text-lg font-bold text-ink dark:text-white">{t("support.title")}</h1>
            <p className="mt-0.5 text-sm text-ink/70 dark:text-white/70">
              {isAdmin ? t("support.subtitleAdmin") : t("support.subtitleUser")}
            </p>
          </div>
        </div>
        {isAdmin ? null : (
          <button type="button" onClick={() => setComposing(true)} className={buttonClass("primary")}>
            <Plus className="h-4 w-4" />
            {t("support.new")}
          </button>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:h-[calc(100vh-13rem)]">
        <section
          className={clsx(
            "flex min-h-0 flex-col rounded-xl border border-line bg-white dark:border-white/10 dark:bg-[#0c0c0e]",
            showDetail && "hidden lg:flex"
          )}
        >
          {isAdmin ? (
            <div className="space-y-2 border-b border-line p-3 dark:border-white/10">
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink/50 dark:text-white/50" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("support.searchPlaceholder")}
                  className="h-9 w-full rounded-lg border border-line bg-paper ps-9 pe-3 text-sm text-ink outline-none transition placeholder:text-ink/50 focus:border-moss/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(ADMIN_VIEWS) as AdminView[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setView(value)}
                    className={clsx(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                      view === value
                        ? "bg-moss text-white"
                        : "border border-line text-ink/70 hover:text-moss dark:border-white/10 dark:text-white/70 dark:hover:text-sea"
                    )}
                  >
                    {t(`support.${value}` as never)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <ThreadList
            threads={threads}
            loading={threadsQuery.isPending}
            selectedId={selectedId}
            isAdmin={isAdmin}
            onSelect={select}
          />
        </section>

        <section
          className={clsx(
            "flex min-h-0 flex-col rounded-xl border border-line bg-white dark:border-white/10 dark:bg-[#0c0c0e]",
            !showDetail && "hidden lg:flex"
          )}
        >
          {composing ? (
            <NewThreadForm
              onCancel={() => setComposing(false)}
              onCreated={(thread) => {
                refreshAll();
                select(thread.id);
              }}
            />
          ) : !selectedId ? (
            <EmptyDetail />
          ) : threadQuery.isPending ? (
            <div className="flex flex-1 items-center justify-center text-ink/70">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : threadQuery.data ? (
            <ThreadView
              thread={threadQuery.data.thread}
              messages={threadQuery.data.messages}
              truncated={threadQuery.data.truncated}
              isAdmin={isAdmin}
              onBack={() => select(null)}
              onChanged={refreshAll}
            />
          ) : (
            <EmptyDetail missing />
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadList({
  threads,
  loading,
  selectedId,
  isAdmin,
  onSelect
}: {
  threads: SupportThread[];
  loading: boolean;
  selectedId: string | null;
  isAdmin: boolean;
  onSelect: (id: string) => void;
}) {
  const { t, lang } = useLang();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-ink/70">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-14 text-center">
        <MessagesSquare className="h-6 w-6 text-ink/40 dark:text-white/40" />
        <p className="text-sm font-medium text-ink dark:text-white">
          {isAdmin ? t("support.emptyInbox") : t("support.emptyList")}
        </p>
        {isAdmin ? null : <p className="text-xs text-ink/70 dark:text-white/70">{t("support.emptyListHint")}</p>}
      </div>
    );
  }

  return (
    <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
      {threads.map((thread) => {
        const unread = isAdmin ? thread.unreadForAdmin : thread.unreadForUser;
        const active = thread.id === selectedId;
        return (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => onSelect(thread.id)}
              aria-current={active ? "true" : undefined}
              className={clsx(
                "w-full rounded-lg p-3 text-start transition",
                active
                  ? "bg-moss/[0.08] dark:bg-sea/15"
                  : "hover:bg-ink/[0.04] dark:hover:bg-white/5"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={clsx(
                    "truncate text-sm",
                    unread > 0 ? "font-semibold text-ink dark:text-white" : "font-medium text-ink/90 dark:text-white/90"
                  )}
                >
                  {thread.subject}
                </span>
                <span className="shrink-0 text-[11px] text-ink/60 dark:text-white/60">
                  {formatRelative(thread.lastMessageAt, lang)}
                </span>
              </div>

              {isAdmin && thread.user.name ? (
                <p className="mt-0.5 truncate text-xs text-ink/60 dark:text-white/60">{thread.user.name}</p>
              ) : null}

              <p className="mt-1 truncate text-xs text-ink/70 dark:text-white/70">
                {thread.lastSenderRole === (isAdmin ? "admin" : "user") ? `${t("support.you")}: ` : ""}
                {thread.lastMessagePreview}
              </p>

              <div className="mt-1.5 flex items-center gap-1.5">
                <TopicChip topic={thread.topic} />
                {thread.status === "closed" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-ink/60 dark:bg-white/10 dark:text-white/60">
                    <Lock className="h-2.5 w-2.5" />
                    {t("support.closed")}
                  </span>
                ) : null}
                {unread > 0 ? (
                  <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-alert px-1.5 text-[11px] font-semibold text-white">
                    {unread}
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ThreadView({
  thread,
  messages,
  truncated,
  isAdmin,
  onBack,
  onChanged
}: {
  thread: SupportThread;
  messages: SupportMessage[];
  truncated: boolean;
  isAdmin: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const { t, lang } = useLang();
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Follow the conversation as it grows, the way any chat transcript should.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [thread.id, messages.length]);

  async function toggleStatus() {
    setBusy(true);
    try {
      await setSupportThreadStatus(thread.id, thread.status === "closed" ? "open" : "closed", token);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="flex items-start gap-3 border-b border-line p-3.5 dark:border-white/10">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("support.back")}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink/70 transition hover:bg-ink/5 hover:text-ink dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink dark:text-white">{thread.subject}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink/60 dark:text-white/60">
            <TopicChip topic={thread.topic} />
            {isAdmin && thread.user.name ? <span className="truncate">{thread.user.name} · {thread.user.email}</span> : null}
            <span>{formatDate(thread.createdAt, lang)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleStatus}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink/70 transition hover:text-moss disabled:opacity-50 dark:border-white/10 dark:text-white/70 dark:hover:text-sea"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : thread.status === "closed" ? (
            <RotateCcw className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {thread.status === "closed" ? t("support.reopen") : t("support.close")}
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {truncated ? (
          <p className="text-center text-xs text-ink/50 dark:text-white/50">{t("support.truncated")}</p>
        ) : null}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            mine={message.senderRole === (isAdmin ? "admin" : "user")}
          />
        ))}
        {thread.status === "closed" ? (
          <p className="pt-2 text-center text-xs text-ink/50 dark:text-white/50">{t("support.closedNotice")}</p>
        ) : null}
      </div>

      <Composer
        placeholder={t("support.replyPlaceholder")}
        onSend={async (body, attachments) => {
          await sendSupportMessage(thread.id, { body, attachments }, token);
          onChanged();
        }}
      />
    </>
  );
}

function MessageBubble({ message, mine }: { message: SupportMessage; mine: boolean }) {
  const { t, lang } = useLang();

  return (
    <div className={clsx("flex flex-col", mine ? "items-end" : "items-start")}>
      <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-ink/60 dark:text-white/60">
        <span className="font-medium">
          {mine ? t("support.you") : message.senderRole === "admin" ? t("support.team") : message.senderName}
        </span>
        <span>{formatDate(message.createdAt, lang)}</span>
      </div>

      <div
        className={clsx(
          "max-w-[85%] rounded-xl px-3.5 py-2.5 sm:max-w-[75%]",
          mine
            ? "bg-moss text-white"
            : "border border-line bg-paper text-ink dark:border-white/10 dark:bg-white/5 dark:text-white"
        )}
      >
        {message.body ? (
          <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.body}
          </p>
        ) : null}

        {message.attachments.length > 0 ? (
          <div className={clsx("flex flex-col gap-2", message.body && "mt-2")}>
            {message.attachments.map((attachment, index) => (
              <AttachmentView key={index} attachment={attachment} mine={mine} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Attachments sit behind the authenticated API, so they can't be plain `src`
 * or `href` targets. Images are fetched as blobs for a preview; anything else
 * stays a one-click download so a large PDF isn't pulled down just by opening
 * the thread.
 */
function AttachmentView({ attachment, mine }: { attachment: SupportAttachment; mine: boolean }) {
  const { token } = useAuth();
  const { t } = useLang();
  const isImage = attachment.mime.startsWith("image/");
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    let created = "";
    fetchSupportAttachmentUrl(attachment.url, token)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        created = url;
        setPreviewUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [isImage, attachment.url, token]);

  async function download() {
    setBusy(true);
    try {
      const url = await fetchSupportAttachmentUrl(attachment.url, token);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // A failed download is self-evident in the UI; nothing to recover from.
    } finally {
      setBusy(false);
    }
  }

  if (isImage) {
    return previewUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl}
        alt={attachment.name}
        className="max-h-64 w-auto max-w-full cursor-zoom-in rounded-lg object-contain"
        onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
      />
    ) : (
      <div
        className={clsx(
          "flex h-24 items-center justify-center rounded-lg",
          mine ? "bg-white/15" : "bg-ink/5 dark:bg-white/10"
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      title={t("support.download")}
      className={clsx(
        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs transition disabled:opacity-60",
        mine ? "bg-white/15 hover:bg-white/25" : "bg-ink/5 hover:bg-ink/10 dark:bg-white/10 dark:hover:bg-white/15"
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}
      <span className="truncate font-medium">{attachment.name}</span>
      <span className="shrink-0 opacity-70">{formatBytes(attachment.size)}</span>
    </button>
  );
}

function NewThreadForm({
  onCancel,
  onCreated
}: {
  onCancel: () => void;
  onCreated: (thread: SupportThread) => void;
}) {
  const { token } = useAuth();
  const { t } = useLang();
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState<SupportTopic>("general");

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-line p-3.5 dark:border-white/10">
        <h2 className="text-sm font-semibold text-ink dark:text-white">{t("support.newTitle")}</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("support.cancel")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 transition hover:bg-ink/5 hover:text-ink dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink/70 dark:text-white/70">
            {t("support.subject")}
          </span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={160}
            dir="auto"
            placeholder={t("support.subjectPlaceholder")}
            className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none transition placeholder:text-ink/50 focus:border-moss/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink/70 dark:text-white/70">
            {t("support.topic")}
          </span>
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value as SupportTopic)}
            className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none transition focus:border-moss/50 dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            {SUPPORT_TOPICS.map((value) => (
              <option key={value} value={value}>
                {t(`support.topic.${value}` as never)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Composer
        placeholder={t("support.messagePlaceholder")}
        disabled={subject.trim().length < 3}
        onSend={async (body, attachments) => {
          const result = await createSupportThread({ subject: subject.trim(), topic, body, attachments }, token);
          onCreated(result.thread);
        }}
      />
    </>
  );
}

/**
 * Shared message box: text, attachments, send. Used to open a thread and to
 * reply in one, so both paths enforce the same limits and keyboard behaviour.
 */
function Composer({
  placeholder,
  disabled = false,
  onSend
}: {
  placeholder: string;
  disabled?: boolean;
  onSend: (body: string, attachments: File[]) => Promise<void>;
}) {
  const errorText = useErrorText();
  const { t } = useLang();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const empty = !body.trim() && files.length === 0;

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.some((file) => file.size > MAX_ATTACHMENT_BYTES)) {
      setError(t("support.fileTooLarge"));
      return;
    }
    if (files.length + picked.length > MAX_ATTACHMENTS) {
      setError(t("support.tooManyFiles"));
      return;
    }
    setError("");
    setFiles((previous) => [...previous, ...picked]);
  }

  async function send() {
    if (empty || disabled || sending) return;
    setSending(true);
    setError("");
    try {
      await onSend(body.trim(), files);
      setBody("");
      setFiles([]);
    } catch (sendError) {
      setError(errorText(sendError, "support.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className="border-t border-line p-3 dark:border-white/10">
      {files.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-ink/5 py-1 pe-1 ps-2.5 text-xs dark:bg-white/10"
            >
              <span className="truncate text-ink/80 dark:text-white/80">{file.name}</span>
              <span className="shrink-0 text-ink/50 dark:text-white/50">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => setFiles((previous) => previous.filter((_, i) => i !== index))}
                aria-label={t("support.removeFile")}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink/60 transition hover:bg-ink/10 hover:text-ink dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="mb-2 text-xs font-medium text-alert">{error}</p> : null}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("support.attach")}
          title={t("support.attachHint")}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-ink/70 transition hover:text-moss dark:border-white/10 dark:text-white/70 dark:hover:text-sea"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={addFiles}
          className="hidden"
        />

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={4000}
          dir="auto"
          placeholder={placeholder}
          className="max-h-32 min-h-10 flex-1 resize-y rounded-lg border border-line bg-paper px-3 py-2.5 text-sm leading-tight text-ink outline-none transition placeholder:text-ink/50 focus:border-moss/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40"
        />

        <button
          type="button"
          onClick={send}
          disabled={empty || disabled || sending}
          className={buttonClass("primary", "w-10 shrink-0 px-0 sm:w-auto sm:px-4")}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
          <span className="hidden sm:inline">{sending ? t("support.sending") : t("support.send")}</span>
        </button>
      </div>
    </div>
  );
}

function EmptyDetail({ missing = false }: { missing?: boolean }) {
  const { t } = useLang();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <MessagesSquare className="h-7 w-7 text-ink/30 dark:text-white/30" />
      <p className="text-sm text-ink/70 dark:text-white/70">
        {missing ? t("support.emptyInbox") : t("support.pickThread")}
      </p>
    </div>
  );
}

function TopicChip({ topic }: { topic: SupportTopic }) {
  const { t } = useLang();
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-moss/10 px-1.5 py-0.5 text-[10px] font-medium text-moss dark:bg-sea/15 dark:text-sea">
      {t(`support.topic.${topic}` as never)}
    </span>
  );
}

/** Keeps the admin's search from firing a request on every keystroke. */
function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string, lang: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60_000],
  ["month", 30 * 24 * 60 * 60_000],
  ["day", 24 * 60 * 60_000],
  ["hour", 60 * 60_000],
  ["minute", 60_000]
];

function formatRelative(value: string, lang: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const elapsed = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(elapsed) >= ms) {
      return formatter.format(Math.round(elapsed / ms), unit);
    }
  }
  return formatter.format(0, "minute");
}

"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { AlertCircle, BookOpen, Bot, ChevronDown, Loader2, Search, Send, Sparkles } from "lucide-react";
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
    <div className="space-y-8">
      <LibraryHero />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="border border-line bg-white shadow-soft dark:border-white/10 dark:bg-white/8">
          <SectionTitle title="اسأل الكتب المرفوعة" icon={<MessageIcon />} />
          <div className="p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-moss dark:text-sea">مساعد معرفي صارم</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-ink dark:text-white">إجابة من كتبك فقط</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink/70 dark:border-white/10 dark:bg-ink/60 dark:text-white/70">
            <Sparkles className="h-4 w-4 text-copper" />
            بدون معرفة خارجية
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="اكتب سؤالا يجب أن تكون إجابته موجودة داخل الكتب المرفوعة."
            className="min-h-36 w-full resize-y rounded-md border border-line bg-paper p-4 text-base outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-ink/70 dark:text-white dark:placeholder:text-white/35"
            maxLength={2000}
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_180px_120px]">
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="نموذج OpenRouter اختياري"
              className="h-11 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-ink/70 dark:text-white"
            />
            <label className="flex h-11 items-center gap-2 rounded-md border border-line bg-paper px-3 text-sm text-ink/70 dark:border-white/10 dark:bg-ink/70 dark:text-white/70">
              المقاطع
              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="mr-auto bg-transparent font-semibold text-ink outline-none dark:text-white"
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
              اسأل
            </button>
          </div>
        </form>

        {loading ? (
          <div className="mt-6 flex items-center gap-3 rounded-md border border-sea/25 bg-sea/10 p-4 text-sm font-medium text-moss dark:text-sea">
            <Search className="h-4 w-4 animate-pulse" />
            جار البحث في الكتب...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {response ? <AnswerPanel response={response} /> : null}
          </div>
        </section>

        <aside className="border border-line bg-white shadow-soft dark:border-white/10 dark:bg-white/8">
          <SectionTitle title="ضوابط الإجابة" icon={<Bot className="h-5 w-5" />} />
          <dl className="space-y-4 p-5 text-sm">
          <div>
            <dt className="font-medium text-ink dark:text-white">حدود الاسترجاع</dt>
            <dd className="mt-1 text-ink/60 dark:text-white/60">يتم إرسال أفضل المقاطع المسترجعة فقط إلى النموذج.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink dark:text-white">عند عدم وجود دليل</dt>
            <dd className="mt-1 text-ink/60 dark:text-white/60">يرجع النظام رسالة عدم العثور بدلا من التخمين.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink dark:text-white">الأدلة</dt>
            <dd className="mt-1 text-ink/60 dark:text-white/60">كل إجابة تعرض المصادر والنصوص الخام ودرجات الصلة.</dd>
          </div>
        </dl>
        </aside>
      </div>
    </div>
  );
}

function LibraryHero() {
  return (
    <section className="relative overflow-hidden border-b-[18px] border-moss bg-white shadow-soft">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.95),rgba(255,255,255,0.78)),repeating-linear-gradient(90deg,rgba(0,0,0,0.04)_0,rgba(0,0,0,0.04)_6px,transparent_6px,transparent_42px)]" />
      <div className="relative grid min-h-[330px] items-end gap-8 px-6 py-10 lg:grid-cols-[1fr_0.95fr] lg:px-12">
        <div className="pb-4 text-right">
          <h1 className="text-4xl font-black leading-tight text-moss drop-shadow-sm sm:text-5xl lg:text-6xl">
            مكتبة الكتب الذكية
          </h1>
          <div className="my-5 h-1 w-full max-w-xl bg-copper" />
          <p className="max-w-2xl text-2xl font-extrabold leading-relaxed text-copper sm:text-3xl">
            إجابات موثقة من إصداراتك وكتبك المرفوعة فقط
          </p>
        </div>
        <div className="flex min-h-52 items-end justify-center gap-3">
          {[
            ["bg-[#e6c766]", "الحوكمة الذكية", "h-48"],
            ["bg-white", "القيادة والإدارة", "h-56"],
            ["bg-[#6aa66d]", "التحول الرقمي", "h-60"],
            ["bg-[#234331]", "أمن المعلومات", "h-52"],
            ["bg-[#eee6d3]", "سلطة العقل", "h-64"]
          ].map(([color, title, height], index) => (
            <div
              key={title}
              className={`relative w-24 ${height} ${color} flex shrink-0 flex-col justify-between border border-black/10 p-3 text-center shadow-[12px_14px_18px_rgba(0,0,0,0.22)]`}
              style={{ transform: `translateY(${index % 2 ? 12 : 0}px) skewY(-1deg)` }}
            >
              <BookOpen className="mx-auto h-7 w-7 text-moss" />
              <span className="text-xs font-bold leading-5 text-ink">{title}</span>
              <span className="h-2 bg-moss/70" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-b from-[#74b66f] to-moss px-5 py-4 text-white">
      <h2 className="text-xl font-semibold">{title}</h2>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-moss/45 shadow-inner">{icon}</span>
    </div>
  );
}

function MessageIcon() {
  return <Bot className="h-5 w-5" />;
}

function AnswerPanel({ response }: { response: ChatResponse }) {
  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-md border border-line bg-paper p-4 dark:border-white/10 dark:bg-ink/60">
        <h2 className="mb-3 text-sm font-semibold uppercase text-ink/55 dark:text-white/55">الإجابة</h2>
        <p className="whitespace-pre-wrap text-base leading-7 text-ink dark:text-white">{response.answer}</p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-ink/55 dark:text-white/55">المصادر</h2>
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
                    صفحة {source.pageNumber}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-ink/70 dark:text-white/65">{source.supportingText}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-line bg-paper p-4 text-sm text-ink/60 dark:border-white/10 dark:bg-ink/60 dark:text-white/60">
            لم يتم العثور على مصادر داعمة.
          </p>
        )}
      </section>

      {response.evidence.length ? (
        <details className="rounded-md border border-line bg-white dark:border-white/10 dark:bg-white/6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink dark:text-white">
            عرض الأدلة
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="space-y-3 border-t border-line p-4 dark:border-white/10">
            {response.evidence.map((chunk) => (
              <article key={chunk.id} className="rounded-md border border-line bg-paper p-4 dark:border-white/10 dark:bg-ink/60">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-ink/55 dark:text-white/55">
                  <span>{chunk.bookName}</span>
                  <span>صفحة {chunk.pageNumber}</span>
                  <span>الدرجة {chunk.score}</span>
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
        تم استرجاع {response.usage.retrievedChunks} مقاطع
        {response.usage.model ? ` باستخدام ${response.usage.model}` : ""}.
      </p>
    </div>
  );
}

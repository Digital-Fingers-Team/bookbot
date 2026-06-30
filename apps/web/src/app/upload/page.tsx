"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  Lock,
  ScanLine,
  Trash2,
  UploadCloud
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError, type UploadedBook, uploadPdfs } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function UploadPage() {
  const { token, user, isAdmin, loading: authLoading } = useAuth();
  const t = useT();
  const [files, setFiles] = useState<File[]>([]);
  const [price, setPrice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<UploadedBook[]>([]);

  function chooseFiles(nextFiles: FileList | File[]) {
    setError("");
    setResults([]);

    const incoming = Array.from(nextFiles);
    if (!incoming.length) {
      return;
    }

    const invalid = incoming.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
    if (invalid) {
      setError(`"${invalid.name}" ${t("up.notPdf")}`);
      return;
    }

    setFiles((current) => {
      const seen = new Set(current.map(fileKey));
      const unique = incoming.filter((file) => {
        const key = fileKey(file);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      return [...current, ...unique];
    });
  }

  function removeFile(file: File) {
    setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)));
  }

  async function submit() {
    if (!files.length || loading || !isAdmin) {
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const numericPrice = Number(price);
      const uploaded = await uploadPdfs(files, token, Number.isFinite(numericPrice) ? numericPrice : 0);
      setResults(uploaded.books);
      setFiles([]);
      setPrice("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("up.uploadFailed"));
    } finally {
      setLoading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFiles(event.dataTransfer.files);
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 dark:border-white/10 dark:bg-[#0c0c0e]">
        <div className="flex items-center gap-3 text-sm font-medium text-ink/60 dark:text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("up.checkingAccess")}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <AdminOnlyUpload userName={user?.name} />;
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-white">{t("up.title")}</h1>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-ink/55 dark:text-white/55">{t("up.subtitle")}</p>
      </header>

      <label
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
          isDragging
            ? "border-moss bg-moss/[0.06] dark:border-sea"
            : "border-line bg-white hover:border-moss/40 dark:border-white/15 dark:bg-[#0c0c0e] dark:hover:border-sea/40"
        }`}
      >
        <span
          className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl transition ${
            isDragging
              ? "bg-moss text-white"
              : "bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea"
          }`}
        >
          <UploadCloud className="h-7 w-7" />
        </span>
        <span className="mt-5 text-base font-semibold text-ink dark:text-white">
          {isDragging ? t("up.dropNow") : t("up.dropHere")}
        </span>
        <span className="mt-1.5 text-sm text-ink/50 dark:text-white/50">
          {t("up.orBrowse")} <span className="font-medium text-moss dark:text-sea">{t("up.browse")}</span> · {t("up.textBest")}
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            if (event.target.files) {
              chooseFiles(event.target.files);
              event.target.value = "";
            }
          }}
        />
      </label>

      {files.length ? (
        <div className="rounded-2xl border border-line bg-white dark:border-white/10 dark:bg-[#0c0c0e]">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink dark:text-white">
                {files.length} {files.length === 1 ? t("up.book") : t("up.books")} {t("up.ready")}
              </p>
              <p className="mt-0.5 text-xs text-ink/45 dark:text-white/45">
                {formatBytes(totalBytes)} · {t("up.separateBooks")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium text-ink/60 dark:text-white/60">{t("up.price")}</span>
                <span className="inline-flex h-10 items-center gap-1 rounded-lg border border-line bg-white px-2.5 dark:border-white/10 dark:bg-white/5">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="0"
                    className="w-16 bg-transparent text-sm text-ink outline-none placeholder:text-ink/35 dark:text-white"
                  />
                  <span className="text-xs text-ink/45 dark:text-white/45">{t("common.currency")}</span>
                </span>
              </label>
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {loading ? t("up.processing") : `${t("up.process")} ${files.length} ${files.length === 1 ? t("up.book") : t("up.books")}`}
              </button>
            </div>
          </div>

          <ul className="divide-y divide-line dark:divide-white/10">
            {files.map((file) => (
              <li key={fileKey(file)} className="flex items-center gap-3 px-4 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper text-moss dark:bg-white/5 dark:text-sea">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink dark:text-white">{file.name}</span>
                <span className="shrink-0 text-xs text-ink/45 dark:text-white/45">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(file)}
                  disabled={loading}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/40 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/40 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  aria-label={file.name}
                  title={file.name}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {results.length ? (
        <div className="rounded-2xl border border-moss/25 bg-moss/[0.05] p-4 dark:border-sea/25 dark:bg-sea/[0.08]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-moss dark:text-sea" />
            <p className="text-sm font-semibold text-ink dark:text-white">
              {t("up.queued")} ({results.length})
            </p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {results.map((result) => (
              <li key={result.bookId} className="flex items-center gap-2 truncate text-sm text-ink/65 dark:text-white/65">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-moss/50 dark:bg-sea/60" />
                <span className="truncate">{result.title}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/library"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-moss transition hover:gap-2.5 dark:text-sea"
          >
            {t("up.trackProgress")}
            <ArrowRight className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard icon={Layers} title={t("up.infoSplitTitle")}>
          {t("up.infoSplitBody")}
        </InfoCard>
        <InfoCard icon={ScanLine} title={t("up.infoOcrTitle")}>
          {t("up.infoOcrBody")}
        </InfoCard>
        <InfoCard icon={Lock} title={t("up.infoPrivacyTitle")}>
          {t("up.infoPrivacyBody")}
        </InfoCard>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children
}: {
  icon: typeof Layers;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]">
      <Icon className="h-4 w-4 text-moss dark:text-sea" />
      <p className="mt-2.5 text-sm font-semibold text-ink dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-ink/50 dark:text-white/50">{children}</p>
    </div>
  );
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminOnlyUpload({ userName }: { userName?: string }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center dark:border-white/10 dark:bg-[#0c0c0e]">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
        <Lock className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-ink dark:text-white">{t("up.adminsOnly")}</h1>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-ink/55 dark:text-white/55">
        {userName ? `${userName} — ${t("up.adminsBody")}` : t("up.signinAdmin")}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/login?next=/upload"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90"
        >
          {t("up.signinAdmin")}
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:text-sea"
        >
          {t("up.backToChat")}
        </Link>
      </div>
    </div>
  );
}

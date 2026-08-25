"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Music2,
  FileSpreadsheet,
  Layers,
  Loader2,
  Lock,
  ScanLine,
  Trash2,
  UploadCloud,
  Check
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError, getCategories, importExcelRows, previewExcel, type ExcelImportRow, type UploadedBook, uploadPdfs } from "@/lib/api";
import { useT } from "@/lib/i18n";

const ACCEPTED_EXTENSIONS = [".pdf", ".epub", ".docx", ".txt"];
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/epub+zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
];
const ACCEPTED_INPUT_ATTR = [...ACCEPTED_EXTENSIONS, ...ACCEPTED_MIME_TYPES].join(",");
const AUDIO_INPUT_ATTR = ".mp3,.m4a,.wav,.ogg,.webm,.aac,.flac,audio/*";
const EXCEL_IMPORT_BATCH_SIZE = 100;

function isAcceptedFile(file: File) {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return ACCEPTED_MIME_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext);
}

export default function UploadPage() {
  const { token, user, isAdmin, loading: authLoading } = useAuth();
  const t = useT();
  const [files, setFiles] = useState<File[]>([]);
  const [summaryAudioByFile, setSummaryAudioByFile] = useState<Record<string, File>>({});
  const [price, setPrice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<UploadedBook[]>([]);
  const [excelRows, setExcelRows] = useState<ExcelImportRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [summaryAudioByRow, setSummaryAudioByRow] = useState<Record<number, File>>({});
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelMessage, setExcelMessage] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  function chooseFiles(nextFiles: FileList | File[]) {
    setError("");
    setResults([]);

    const incoming = Array.from(nextFiles);
    if (!incoming.length) {
      return;
    }

    const invalid = incoming.find((file) => !isAcceptedFile(file));
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
    const key = fileKey(file);
    setFiles((current) => current.filter((item) => fileKey(item) !== key));
    setSummaryAudioByFile((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function chooseSummaryAudio(book: File, audio: File | undefined) {
    if (audio && !isAcceptedAudio(audio)) {
      setError(`"${audio.name}" is not a supported audio file.`);
      return;
    }
    setError("");
    const key = fileKey(book);
    setSummaryAudioByFile((current) => {
      const next = { ...current };
      if (audio) next[key] = audio;
      else delete next[key];
      return next;
    });
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
      const uploaded = await uploadPdfs(files, token, Number.isFinite(numericPrice) ? numericPrice : 0, files.map((file) => summaryAudioByFile[fileKey(file)]));
      setResults(uploaded.books);
      setFiles([]);
      setSummaryAudioByFile({});
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
        <div className="flex items-center gap-3 text-sm font-medium text-ink/70 dark:text-white/70">
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

  async function importSelectedExcelRows() {
    setExcelLoading(true);
    setExcelMessage("");
    const selected = excelRows.filter((row) => selectedRows.has(row.rowNumber));
    const batches = chunkRows(selected, EXCEL_IMPORT_BATCH_SIZE);
    let queuedCount = 0;
    let failedCount = 0;
    let firstError = "";

    try {
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        if (!batch) break;
        setExcelMessage(`Importing batch ${index + 1} of ${batches.length}…`);
        const result = await importExcelRows(batch, token, summaryAudioByRow);
        queuedCount += result.books.length;
        failedCount += result.errors.length;
        firstError ||= result.errors[0]?.error ?? "";

        // Remove each completed batch immediately. If a later batch fails,
        // already-queued books do not get submitted a second time on retry.
        const completedNumbers = new Set(batch.map((row) => row.rowNumber));
        setExcelRows((current) => current.filter((row) => !completedNumbers.has(row.rowNumber)));
        setSelectedRows((current) => new Set([...current].filter((rowNumber) => !completedNumbers.has(rowNumber))));
        setSummaryAudioByRow((current) => Object.fromEntries(
          Object.entries(current).filter(([rowNumber]) => !completedNumbers.has(Number(rowNumber)))
        ));
      }

      setExcelMessage(`${queuedCount} books queued${failedCount ? `; ${failedCount} failed${firstError ? ` — ${firstError}` : ""}.` : "."}`);
    } catch (err) {
      setExcelMessage(err instanceof Error ? err.message : "Import failed. Completed batches were kept.");
    } finally {
      setExcelLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-white">{t("up.title")}</h1>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-ink/70 dark:text-white/70">{t("up.subtitle")}</p>
      </header>

      {/* Keep the primary book picker first in document order; the visible picker
          below uses the same handler and remains the main interaction surface. */}
      <input
        type="file"
        accept={ACCEPTED_INPUT_ATTR}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          if (event.target.files) {
            chooseFiles(event.target.files);
            event.target.value = "";
          }
        }}
      />

      <ExcelImportPanel token={token} rows={excelRows} selected={selectedRows} categories={categories} loading={excelLoading} message={excelMessage}
        onFile={async (file) => { setExcelLoading(true); setExcelMessage(""); try { const [result, categoryResult] = await Promise.all([previewExcel(file, token), getCategories(token)]); setExcelRows(result.rows.map((row) => ({ ...row, price: 0, category: "" }))); setCategories(categoryResult.categories); setSelectedRows(new Set()); setSummaryAudioByRow({}); setExcelMessage(`${result.total} books found. Select books to import; large selections are processed in batches.`); } catch (err) { setExcelMessage(err instanceof Error ? err.message : "The workbook could not be read."); } finally { setExcelLoading(false); } }}
        onToggle={(rowNumber) => setSelectedRows((current) => { const next = new Set(current); next.has(rowNumber) ? next.delete(rowNumber) : next.add(rowNumber); return next; })}
        onUpdate={(rowNumber, patch) => setExcelRows((current) => current.map((row) => row.rowNumber === rowNumber ? { ...row, ...patch } : row))}
        onAudio={(rowNumber, audio) => { if (audio && !isAcceptedAudio(audio)) { setExcelMessage(`"${audio.name}" is not a supported audio file.`); return; } setExcelMessage(""); setSummaryAudioByRow((current) => { const next = { ...current }; if (audio) next[rowNumber] = audio; else delete next[rowNumber]; return next; }); }}
        audioByRow={summaryAudioByRow}
        onImport={importSelectedExcelRows} />

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
        <span className="mt-1.5 text-sm text-ink/70 dark:text-white/70">
          {t("up.orBrowse")} <span className="font-medium text-moss dark:text-sea">{t("up.browse")}</span> · {t("up.textBest")}
        </span>
        <input
          type="file"
          accept={ACCEPTED_INPUT_ATTR}
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
              <p className="mt-0.5 text-xs text-ink/70 dark:text-white/70">
                {formatBytes(totalBytes)} · {t("up.separateBooks")}
              </p>
              <p className="mt-1 text-xs text-moss/80 dark:text-sea/80">Summary audio is optional and can also be added later from Library.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium text-ink/70 dark:text-white/70">{t("up.price")}</span>
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
                  <span className="text-xs text-ink/70 dark:text-white/70">{t("common.currency")}</span>
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
              <li key={fileKey(file)} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper text-moss dark:bg-white/5 dark:text-sea">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink dark:text-white">{file.name}</span>
                <span className="shrink-0 text-xs text-ink/70 dark:text-white/70">{formatBytes(file.size)}</span>
                <label className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-xs font-medium text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:text-white/70 dark:hover:text-sea">
                  <Music2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-36 truncate">{summaryAudioByFile[fileKey(file)]?.name ?? "Add summary audio"}</span>
                  <input
                    type="file"
                    accept={AUDIO_INPUT_ATTR}
                    className="sr-only"
                    disabled={loading}
                    onChange={(event) => {
                      chooseSummaryAudio(file, event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                {summaryAudioByFile[fileKey(file)] ? <span className="text-[11px] text-moss dark:text-sea">Attached</span> : null}
                <button
                  type="button"
                  onClick={() => removeFile(file)}
                  disabled={loading}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/70 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/70 dark:hover:bg-red-500/10 dark:hover:text-red-300"
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

function chunkRows<T>(rows: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    batches.push(rows.slice(index, index + size));
  }
  return batches;
}

function isAcceptedAudio(file: File) {
  return file.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|webm|aac|flac)$/i.test(file.name);
}

function ExcelImportPanel({ token, rows, selected, categories, loading, message, audioByRow, onFile, onToggle, onUpdate, onAudio, onImport }: {
  token?: string; rows: ExcelImportRow[]; selected: Set<number>; categories: string[]; loading: boolean; message: string; audioByRow: Record<number, File>;
  onFile: (file: File) => void; onToggle: (row: number) => void; onUpdate: (row: number, patch: Partial<ExcelImportRow>) => void; onAudio: (row: number, audio: File | undefined) => void; onImport: () => void;
}) {
  return <section className="rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-[#0c0c0e]">
    <div className="flex items-start gap-3"><FileSpreadsheet className="mt-1 h-5 w-5 text-moss dark:text-sea" /><div><h2 className="font-semibold text-ink dark:text-white">Import books from Excel</h2><p className="mt-1 text-xs text-ink/65 dark:text-white/65">Upload the list, choose specific books, then import only those PDFs.</p></div></div>
    <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium dark:border-white/10"><FileSpreadsheet className="h-4 w-4" />{loading ? "Reading…" : "Choose .xlsx"}<input type="file" accept=".xlsx" className="sr-only" disabled={loading} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
    {message ? <p className="mt-3 text-sm text-ink/70 dark:text-white/70">{message}</p> : null}
    {rows.length ? <><div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><button type="button" onClick={() => rows.forEach((row) => !selected.has(row.rowNumber) && onToggle(row.rowNumber))} className="rounded border border-line px-2 py-1 dark:border-white/10">Select all</button><button type="button" onClick={() => rows.forEach((row) => selected.has(row.rowNumber) && onToggle(row.rowNumber))} className="rounded border border-line px-2 py-1 dark:border-white/10">Deselect all</button><span className="text-ink/60 dark:text-white/60">{selected.size} selected</span></div><div className="mt-2 max-h-96 overflow-auto rounded-lg border border-line dark:border-white/10">{rows.map((row) => <div key={row.rowNumber} className="border-b border-line p-3 last:border-0 dark:border-white/10"><div className="flex items-start gap-3"><input type="checkbox" checked={selected.has(row.rowNumber)} onChange={() => onToggle(row.rowNumber)} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink dark:text-white">{row.title}</span><span className="block text-xs text-ink/60 dark:text-white/60">{row.author || "Unknown author"} · row {row.rowNumber}</span></span>{selected.has(row.rowNumber) ? <Check className="h-4 w-4 shrink-0 text-moss dark:text-sea" /> : null}</div><div className="mt-2 grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2"><input type="number" min="0" step="any" value={row.price || ""} onChange={(e) => onUpdate(row.rowNumber, { price: Number(e.target.value) || 0 })} placeholder="Price (optional)" className="h-9 rounded border border-line bg-transparent px-2 text-xs outline-none dark:border-white/10" /><select value={row.category || ""} onChange={(e) => onUpdate(row.rowNumber, { category: e.target.value })} className="h-9 rounded border border-line bg-transparent px-2 text-xs outline-none dark:border-white/10"><option value="">No category</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><label className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded border border-dashed border-line px-2 text-xs font-medium text-ink/70 hover:border-moss/40 hover:text-moss dark:border-white/10 dark:text-white/70 dark:hover:text-sea"><Music2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{audioByRow[row.rowNumber]?.name ?? "Add summary audio"}</span><input type="file" accept={AUDIO_INPUT_ATTR} className="sr-only" disabled={loading} onChange={(e) => { onAudio(row.rowNumber, e.target.files?.[0]); e.target.value = ""; }} /></label></div></div>)}</div><button type="button" disabled={!selected.size || loading} onClick={onImport} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-moss px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading ? "Importing…" : `Import ${selected.size} selected`}</button></> : null}
  </section>;
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
      <p className="mt-1 text-xs leading-5 text-ink/70 dark:text-white/70">{children}</p>
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
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-ink/70 dark:text-white/70">
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

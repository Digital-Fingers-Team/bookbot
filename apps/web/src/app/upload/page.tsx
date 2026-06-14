"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, UploadCloud } from "lucide-react";
import { AdminKeyField } from "@/components/admin-key-field";
import { useAdminKey } from "@/hooks/use-admin-key";
import { ApiClientError, uploadPdf } from "@/lib/api";

export default function UploadPage() {
  const { adminKey } = useAdminKey();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ title: string; pageCount: number; chunkCount: number } | null>(null);

  function chooseFile(nextFile: File | null) {
    setError("");
    setResult(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (nextFile.type !== "application/pdf" && !nextFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      setFile(null);
      return;
    }

    setFile(nextFile);
  }

  async function submit() {
    if (!file || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const uploaded = await uploadPdf(file, adminKey);
      setResult(uploaded);
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files.item(0));
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-md border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/8 sm:p-6">
        <div className="mb-5">
          <p className="text-sm font-semibold text-moss dark:text-sea">Ingestion layer</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink dark:text-white">Upload PDF books</h1>
        </div>

        <label
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-8 text-center transition ${
            isDragging
              ? "border-sea bg-sea/10"
              : "border-line bg-paper hover:border-sea dark:border-white/10 dark:bg-ink/60"
          }`}
        >
          <UploadCloud className="h-10 w-10 text-moss dark:text-sea" />
          <span className="mt-4 text-base font-semibold text-ink dark:text-white">Drop a PDF or choose a file</span>
          <span className="mt-2 text-sm text-ink/55 dark:text-white/55">Text-based books work best for page citations.</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.item(0) ?? null)}
          />
        </label>

        {file ? (
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-line bg-paper p-4 dark:border-white/10 dark:bg-ink/60 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-sea" />
              <span className="truncate text-sm font-medium text-ink dark:text-white">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white shadow-sm shadow-moss/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Process book
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-copper/30 bg-copper/10 p-4 text-sm text-copper">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-moss/30 bg-moss/10 p-4 text-sm text-moss dark:text-white">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">{result.title}</span> was ingested into {result.chunkCount} chunks across{" "}
              {result.pageCount} pages.
            </p>
          </div>
        ) : null}
      </section>

      <aside className="rounded-md border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/8">
        <AdminKeyField />
        <div className="mt-6 space-y-4 text-sm text-ink/65 dark:text-white/65">
          <p>Uploaded PDFs are split per page into bounded chunks and stored with book/page metadata.</p>
          <p>Full book text is never sent to OpenRouter; only retrieved evidence chunks are used during chat.</p>
        </div>
      </aside>
    </div>
  );
}

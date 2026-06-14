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
      <section className="border border-line bg-white shadow-soft dark:border-white/10 dark:bg-white/8">
        <div className="flex items-center justify-between bg-gradient-to-b from-[#74b66f] to-moss px-5 py-4 text-white">
          <h1 className="text-xl font-semibold">Upload a new book</h1>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-moss/45 shadow-inner">
            <UploadCloud className="h-5 w-5" />
          </span>
        </div>
        <div className="p-5 sm:p-6">
          <p className="mb-5 text-sm leading-7 text-ink/65 dark:text-white/65">
            Upload a PDF so BookBot can extract text, split it into searchable chunks, and preserve source pages.
          </p>

        <label
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-8 text-center transition ${
            isDragging
              ? "border-moss bg-moss/10"
              : "border-line bg-paper hover:border-moss dark:border-white/10 dark:bg-ink/60"
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
              <FileText className="h-5 w-5 shrink-0 text-moss dark:text-sea" />
              <span className="truncate text-sm font-medium text-ink dark:text-white">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white shadow-sm shadow-moss/20 transition hover:bg-[#064b26] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Process book
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-moss/30 bg-moss/10 p-4 text-sm text-moss dark:text-white">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">{result.title}</span> was added as {result.chunkCount} chunks across{" "}
              {result.pageCount} pages.
            </p>
          </div>
        ) : null}
        </div>
      </section>

      <aside className="border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/8">
        <AdminKeyField />
        <div className="mt-6 space-y-4 text-sm text-ink/65 dark:text-white/65">
          <p>Uploaded PDFs are split by page and stored with source metadata for every chunk.</p>
          <p>The full book is never sent to OpenRouter; only retrieved evidence chunks are used.</p>
        </div>
      </aside>
    </div>
  );
}

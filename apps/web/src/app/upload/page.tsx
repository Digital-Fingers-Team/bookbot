"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError, type UploadedBook, uploadPdfs } from "@/lib/api";

export default function UploadPage() {
  const { token, user, isAdmin, loading: authLoading } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
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
      setError(`"${invalid.name}" is not a PDF file.`);
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
      const uploaded = await uploadPdfs(files, token);
      setResults(uploaded.books);
      setFiles([]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed. Please try again.");
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
      <div className="mx-auto max-w-xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/8">
        <div className="flex items-center gap-3 text-sm font-medium text-ink/65 dark:text-white/65">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking admin access...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <AdminOnlyUpload userName={user?.name} />;
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
            Upload PDFs so BookBot can extract text, split each book into searchable chunks, and preserve source pages.
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
            <span className="mt-4 text-base font-semibold text-ink dark:text-white">Drop PDFs or choose files</span>
            <span className="mt-2 text-sm text-ink/55 dark:text-white/55">Text-based books work best for page citations.</span>
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
          <div className="mt-4 rounded-md border border-line bg-paper p-4 dark:border-white/10 dark:bg-ink/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink dark:text-white">
                  {files.length} {files.length === 1 ? "book" : "books"} ready to process
                </p>
                <p className="mt-1 text-xs text-ink/50 dark:text-white/50">Each PDF will be added as a separate library book.</p>
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white shadow-sm shadow-moss/20 transition hover:bg-[#064b26] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Process {files.length === 1 ? "book" : "books"}
              </button>
            </div>

            <div className="mt-4 divide-y divide-line overflow-hidden rounded-md border border-line bg-white dark:divide-white/10 dark:border-white/10 dark:bg-ink/75">
              {files.map((file) => (
                <div key={fileKey(file)} className="flex items-center gap-3 px-3 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-moss dark:text-sea" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink dark:text-white">{file.name}</span>
                  <span className="shrink-0 text-xs text-ink/45 dark:text-white/45">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(file)}
                    disabled={loading}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-500/10"
                    aria-label={`Remove ${file.name}`}
                    title={`Remove ${file.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {results.length ? (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-moss/30 bg-moss/10 p-4 text-sm text-moss dark:text-white">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">
                Added {results.length} {results.length === 1 ? "book" : "books"} to the library.
              </p>
              <ul className="mt-2 space-y-1">
                {results.map((result) => (
                  <li key={result.bookId} className="truncate">
                    {result.title} - {result.chunkCount} chunks across {result.pageCount} pages
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        </div>
      </section>

      <aside className="border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/8">
        <h2 className="text-base font-semibold text-ink dark:text-white">Access</h2>
        <div className="mt-3 rounded-md border border-moss/20 bg-moss/10 p-4 text-sm text-moss dark:border-sea/25 dark:bg-sea/10 dark:text-sea">
          Signed in as admin. Uploads will be attached to the shared BookBot library.
        </div>
        <div className="mt-6 space-y-4 text-sm text-ink/65 dark:text-white/65">
          <p>Uploaded PDFs are split by page and stored with source metadata for every chunk.</p>
          <p>The full book is never sent to OpenRouter; only retrieved evidence chunks are used.</p>
        </div>
      </aside>
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
  return (
    <div className="mx-auto max-w-2xl overflow-hidden border border-line bg-white shadow-soft dark:border-white/10 dark:bg-white/8">
      <div className="flex items-center justify-between bg-moss px-5 py-4 text-white">
        <h1 className="text-xl font-semibold">Admin upload only</h1>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
          <UploadCloud className="h-5 w-5" />
        </span>
      </div>
      <div className="space-y-4 p-6">
        <p className="text-sm leading-7 text-ink/70 dark:text-white/70">
          {userName
            ? `${userName}, your account can ask questions and view the library, but only admins can upload books.`
            : "Please sign in as an admin to upload books."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login?next=/upload"
            className="inline-flex h-10 items-center justify-center rounded-md bg-moss px-4 text-sm font-semibold text-white transition hover:bg-[#064b26]"
          >
            Sign in as admin
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss dark:border-white/10 dark:bg-ink/70 dark:text-white"
          >
            Back to chat
          </Link>
        </div>
      </div>
    </div>
  );
}

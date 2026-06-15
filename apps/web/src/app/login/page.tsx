"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useEffect, useState } from "react";
import { AlertCircle, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError } from "@/lib/api";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nextPath = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath);
    }
  }, [loading, nextPath, router, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await login({ email: email.trim(), password });
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden border border-line bg-white shadow-soft dark:border-white/10 dark:bg-white/8">
        <div className="bg-moss px-6 py-5 text-white">
          <p className="text-sm font-semibold uppercase text-white/75">Secure access</p>
          <h1 className="mt-1 text-2xl font-semibold">Sign in to BookBot</h1>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6">
          <label className="block text-sm font-semibold text-ink dark:text-white">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-ink/80 dark:text-white"
              required
            />
          </label>

          <label className="block text-sm font-semibold text-ink dark:text-white">
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-ink/80 dark:text-white"
              required
            />
          </label>

          {error ? (
            <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white shadow-sm shadow-moss/20 transition hover:bg-[#064b26] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Sign in
          </button>

          <p className="text-sm text-ink/60 dark:text-white/60">
            Need a user account?{" "}
            <Link href="/register" className="font-semibold text-moss hover:underline dark:text-sea">
              Create one
            </Link>
            .
          </p>
        </form>
      </section>

      <aside className="border border-line bg-paper p-5 shadow-soft dark:border-white/10 dark:bg-white/8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-ink dark:text-white">Default admin</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65 dark:text-white/65">
          The API seeds the first admin account from environment variables. For local setup, use the credentials already filled in here.
        </p>
        <div className="mt-4 rounded-md border border-line bg-white p-4 text-sm dark:border-white/10 dark:bg-ink/70">
          <p className="font-semibold text-ink dark:text-white">admin@example.com</p>
          <p className="mt-1 text-ink/55 dark:text-white/55">admin123</p>
        </div>
      </aside>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="mx-auto max-w-xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/8">
      <div className="flex items-center gap-3 text-sm font-medium text-ink/65 dark:text-white/65">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading sign in...
      </div>
    </div>
  );
}

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { AlertCircle, Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { register, user, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await register({ name: name.trim(), email: email.trim(), password });
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create the account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl overflow-hidden border border-line bg-white shadow-soft dark:border-white/10 dark:bg-white/8">
      <div className="bg-moss px-6 py-5 text-white">
        <p className="text-sm font-semibold uppercase text-white/75">User access</p>
        <h1 className="mt-1 text-2xl font-semibold">Create a BookBot account</h1>
      </div>

      <form onSubmit={submit} className="space-y-5 p-6">
        <label className="block text-sm font-semibold text-ink dark:text-white">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-ink/80 dark:text-white"
            required
          />
        </label>

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
            autoComplete="new-password"
            minLength={6}
            maxLength={128}
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
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Create account
        </button>

        <p className="text-sm text-ink/60 dark:text-white/60">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-moss hover:underline dark:text-sea">
            Sign in
          </Link>
          .
        </p>
      </form>
    </div>
  );
}

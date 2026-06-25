"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { AuthField, AuthShell, ErrorBanner, authInputClass } from "@/components/auth-shell";
import { ApiClientError } from "@/lib/api";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setError(err instanceof ApiClientError ? err.message : t("auth.signinError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title={t("auth.welcomeBack")} subtitle={t("auth.signinSubtitle")}>
      <form onSubmit={submit} className="space-y-4">
        <AuthField label={t("auth.email")}>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={authInputClass}
            required
          />
        </AuthField>

        <AuthField label={t("auth.password")}>
          <div className="relative">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className={`${authInputClass} pe-11`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute end-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink/40 transition hover:bg-ink/5 hover:text-ink dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </AuthField>

        {error ? <ErrorBanner message={error} /> : null}

        <button
          type="submit"
          disabled={submitting || loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {t("auth.signin")}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink/55 dark:text-white/55">
        {t("auth.needAccount")}{" "}
        <Link href="/register" className="font-medium text-moss hover:underline dark:text-sea">
          {t("auth.createOne")}
        </Link>
      </p>
    </AuthShell>
  );
}

function LoginFallback() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-6">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-[#0c0c0e]">
        <div className="flex items-center gap-3 text-sm font-medium text-ink/60 dark:text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
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

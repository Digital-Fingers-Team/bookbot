"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { AuthField, AuthShell, ErrorBanner, authInputClass } from "@/components/auth-shell";
import { ApiClientError } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const { register, user, loading } = useAuth();
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setError(err instanceof ApiClientError ? err.message : t("auth.createError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title={t("auth.createTitle")} subtitle={t("auth.createSubtitle")}>
      <form onSubmit={submit} className="space-y-4">
        <AuthField label={t("auth.name")}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            placeholder={t("auth.namePlaceholder")}
            className={authInputClass}
            required
          />
        </AuthField>

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
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              placeholder={t("auth.passwordHint")}
              className={`${authInputClass} pe-11`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute end-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink/70 transition hover:bg-ink/5 hover:text-ink dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
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
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {t("auth.create")}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink/70 dark:text-white/70">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-medium text-moss hover:underline dark:text-sea">
          {t("auth.signin")}
        </Link>
      </p>
    </AuthShell>
  );
}

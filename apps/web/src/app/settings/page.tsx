"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BookOpen, CheckCircle2, ExternalLink, KeyRound, Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  ApiClientError,
  activateOmpAuthorAccount,
  changePassword,
  getOmpAuthorAccount,
  getOmpLoginLink,
  type OmpAuthorLink
} from "@/lib/api";
import { useT } from "@/lib/i18n";

const inputClass =
  "h-11 w-full rounded-lg border border-line bg-white px-3.5 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/35";

export default function SettingsPage() {
  const router = useRouter();
  const { token, user, loading, updateProfile, logout } = useAuth();
  const t = useT();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [error, setError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=/settings");
      return;
    }

    if (user) {
      setName(user.name);
      setLanguage(user.language === "ar" ? "ar" : "en");
    }
  }, [loading, router, user]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || savingProfile) {
      return;
    }

    setSavingProfile(true);
    setError("");
    setProfileStatus("");

    try {
      await updateProfile({ name: name.trim(), language });
      setProfileStatus(t("set.profileUpdated"));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("set.profileError"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || savingPassword) {
      return;
    }

    setSavingPassword(true);
    setError("");
    setPasswordStatus("");

    try {
      await changePassword({ currentPassword, newPassword }, token);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordStatus(t("set.passwordChanged"));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("set.passwordError"));
    } finally {
      setSavingPassword(false);
    }
  }

  function signOut() {
    logout();
    router.replace("/login");
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 dark:border-white/10 dark:bg-[#0c0c0e]">
        <div className="flex items-center gap-3 text-sm font-medium text-ink/70 dark:text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loading ? t("set.loadingProfile") : t("lib.redirecting")}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-white">{t("set.title")}</h1>
        <p className="mt-1.5 text-sm text-ink/70 dark:text-white/70">{t("set.subtitle")}</p>
      </header>

      {/* Account summary */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-[#0c0c0e] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-moss text-lg font-semibold uppercase text-white">
            {user.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold text-ink dark:text-white">{user.name}</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-moss/20 bg-moss/[0.06] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-moss dark:border-sea/25 dark:bg-sea/10 dark:text-sea">
                <ShieldCheck className="h-3 w-3" />
                {user.role === "admin" ? t("role.admin") : t("role.user")}
              </span>
            </div>
            <p className="truncate text-sm text-ink/70 dark:text-white/70">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink/70 transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:border-red-500/40 dark:hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          {t("set.logout")}
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={UserRound} title={t("set.profile")} description={t("set.profileDesc")}>
          <form onSubmit={submitProfile} className="space-y-4">
            <Field label={t("set.name")}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                required
                minLength={2}
                maxLength={120}
              />
            </Field>

            <Field label={t("set.langField")}>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "ar")}
                className={inputClass}
              >
                <option value="en">{t("set.english")}</option>
                <option value="ar">{t("set.arabic")}</option>
              </select>
            </Field>

            <SubmitButton loading={savingProfile} icon={CheckCircle2}>
              {t("set.save")}
            </SubmitButton>

            {profileStatus ? <StatusMessage>{profileStatus}</StatusMessage> : null}
          </form>
        </SectionCard>

        <SectionCard icon={KeyRound} title={t("set.password")} description={t("set.passwordDesc")}>
          <form onSubmit={submitPassword} className="space-y-4">
            <Field label={t("set.currentPassword")}>
              <input
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                className={inputClass}
                required
              />
            </Field>

            <Field label={t("set.newPassword")}>
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={128}
                className={inputClass}
                required
              />
            </Field>

            <SubmitButton loading={savingPassword} icon={KeyRound}>
              {t("set.updatePassword")}
            </SubmitButton>

            {passwordStatus ? <StatusMessage>{passwordStatus}</StatusMessage> : null}
          </form>
        </SectionCard>
      </div>

      <OmpPublishingCard token={token} />
    </div>
  );
}

function OmpPublishingCard({ token }: { token: string | null }) {
  const t = useT();
  const [link, setLink] = useState<OmpAuthorLink | null>(null);
  const [loadingLink, setLoadingLink] = useState(true);
  const [activating, setActivating] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }
    let active = true;
    getOmpAuthorAccount(token)
      .then((result) => {
        if (active) {
          setLink(result);
        }
      })
      .catch(() => {
        if (active) {
          setLink({ linked: false });
        }
      })
      .finally(() => {
        if (active) {
          setLoadingLink(false);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function activate() {
    if (!token || activating) {
      return;
    }
    setActivating(true);
    setError("");
    try {
      setLink(await activateOmpAuthorAccount(token));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("omp.activateError"));
    } finally {
      setActivating(false);
    }
  }

  async function openOmp() {
    if (!token || opening) {
      return;
    }
    setOpening(true);
    setError("");
    try {
      const { url } = await getOmpLoginLink(token);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("omp.openError"));
    } finally {
      setOpening(false);
    }
  }

  return (
    <SectionCard icon={BookOpen} title={t("omp.title")} description={t("omp.desc")}>
      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {loadingLink ? (
        <div className="flex items-center gap-3 text-sm font-medium text-ink/70 dark:text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("set.loadingProfile")}
        </div>
      ) : link?.linked ? (
        <div className="space-y-4">
          <StatusMessage>{t("omp.linked")}</StatusMessage>
          <button
            type="button"
            onClick={openOmp}
            disabled={opening}
            className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {opening ? t("omp.opening") : t("omp.enter")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={activate}
          disabled={activating}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
          {activating ? t("omp.activating") : t("omp.activate")}
        </button>
      )}
    </SectionCard>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-[#0c0c0e] sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[0.95rem] font-semibold text-ink dark:text-white">{title}</h2>
          <p className="text-xs text-ink/70 dark:text-white/70">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/80 dark:text-white/80">{label}</span>
      {children}
    </label>
  );
}

function SubmitButton({
  loading,
  icon: Icon,
  children
}: {
  loading: boolean;
  icon: typeof KeyRound;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-moss/20 bg-moss/[0.06] p-3 text-sm font-medium text-moss dark:border-sea/25 dark:bg-sea/10 dark:text-sea">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      {children}
    </p>
  );
}

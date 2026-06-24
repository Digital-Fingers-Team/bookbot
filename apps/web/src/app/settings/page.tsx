"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError, changePassword } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const { token, user, loading, updateProfile, logout } = useAuth();
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
      setProfileStatus("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update your profile.");
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
      setPasswordStatus("Password changed.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not change your password.");
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
      <div className="mx-auto max-w-xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-ink/85">
        <div className="flex items-center gap-3 text-sm font-medium text-ink/65 dark:text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loading ? "Loading profile..." : "Redirecting to sign in..."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="overflow-hidden border border-line bg-white shadow-soft dark:border-white/10 dark:bg-ink/85">
        <div className="flex flex-col gap-4 bg-moss px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-white/70">{user.role} profile</p>
            <h1 className="mt-1 text-2xl font-semibold">Settings</h1>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-moss transition hover:bg-paper"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-2 lg:p-6">
          <form onSubmit={submitProfile} className="space-y-5 rounded-md border border-line bg-paper p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-moss/10 text-moss dark:bg-sea/10 dark:text-sea">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-ink dark:text-white">My profile</h2>
                <p className="text-sm text-ink/55 dark:text-white/55">{user.email}</p>
              </div>
            </div>

            <label className="block text-sm font-semibold text-ink dark:text-white">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-ink/80 dark:text-white"
                required
                minLength={2}
                maxLength={120}
              />
            </label>

            <label className="block text-sm font-semibold text-ink dark:text-white">
              Language
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "ar")}
                className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-ink/80 dark:text-white"
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white transition hover:bg-[#064b26] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save profile
            </button>

            {profileStatus ? <StatusMessage>{profileStatus}</StatusMessage> : null}
          </form>

          <form onSubmit={submitPassword} className="space-y-5 rounded-md border border-line bg-paper p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-moss/10 text-moss dark:bg-sea/10 dark:text-sea">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-ink dark:text-white">Change password</h2>
                <p className="text-sm text-ink/55 dark:text-white/55">Use at least 6 characters.</p>
              </div>
            </div>

            <label className="block text-sm font-semibold text-ink dark:text-white">
              Current password
              <input
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-ink/80 dark:text-white"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-ink dark:text-white">
              New password
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={128}
                className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-ink/80 dark:text-white"
                required
              />
            </label>

            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white transition hover:bg-[#064b26] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Change password
            </button>

            {passwordStatus ? <StatusMessage>{passwordStatus}</StatusMessage> : null}
          </form>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}
    </div>
  );
}

function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-moss/20 bg-moss/10 p-3 text-sm font-medium text-moss dark:border-sea/25 dark:bg-sea/10 dark:text-sea">
      {children}
    </p>
  );
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ShieldCheck, UserMinus, X } from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/components/auth-provider";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  ADMIN_PERMISSIONS,
  ApiClientError,
  createAdminAccount,
  demoteAdminAccount,
  listAdminAccounts,
  updateAdminAccount,
  type AdminAccount,
  type AdminPermission
} from "@/lib/api";
import { useLang } from "@/lib/i18n";

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none transition placeholder:text-ink/50 focus:border-moss/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40";

/**
 * Admin accounts and what each of them may reach. Every row is one account; the
 * checkboxes are the account's permissions, saved as they are toggled so there
 * is no separate "save" step to forget.
 */
export default function AdminsPage() {
  const router = useRouter();
  const { token, user, loading: authLoading, can } = useAuth();
  const { t } = useLang();
  const allowed = can("admins");

  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [demoting, setDemoting] = useState<AdminAccount | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setAdmins((await listAdminAccounts(token)).admins);
    } catch {
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowed) {
      router.replace("/");
      return;
    }
    refresh();
  }, [authLoading, user, allowed, refresh, router]);

  if (authLoading || !allowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink/70 dark:text-white/70">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  async function togglePermission(admin: AdminAccount, permission: AdminPermission, next: boolean) {
    const permissions = next
      ? [...admin.permissions, permission]
      : admin.permissions.filter((value) => value !== permission);

    // Optimistic: the checkbox should feel like a switch, not a form field.
    setAdmins((previous) => previous.map((row) => (row.id === admin.id ? { ...row, permissions } : row)));
    setError("");
    try {
      await updateAdminAccount(admin.id, { permissions }, token);
    } catch (updateError) {
      setAdmins((previous) => previous.map((row) => (row.id === admin.id ? admin : row)));
      setError(updateError instanceof ApiClientError ? updateError.message : t("admins.saveFailed"));
    }
  }

  async function demote(admin: AdminAccount) {
    setError("");
    try {
      await demoteAdminAccount(admin.id, token);
      setAdmins((previous) => previous.filter((row) => row.id !== admin.id));
    } catch (demoteError) {
      setError(demoteError instanceof ApiClientError ? demoteError.message : t("admins.saveFailed"));
    } finally {
      setDemoting(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-2">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-moss dark:text-sea" />
          <div>
            <h1 className="text-lg font-bold text-ink dark:text-white">{t("admins.title")}</h1>
            <p className="mt-0.5 text-sm text-ink/70 dark:text-white/70">{t("admins.subtitle")}</p>
          </div>
        </div>
        <button type="button" onClick={() => setCreating(true)} className={buttonClass("primary")}>
          <Plus className="h-4 w-4" />
          {t("admins.new")}
        </button>
      </header>

      {error ? (
        <p className="mb-4 rounded-lg border border-alert/30 bg-alert/5 px-3 py-2 text-sm font-medium text-alert">
          {error}
        </p>
      ) : null}

      {creating ? (
        <NewAdminForm
          onCancel={() => setCreating(false)}
          onCreated={(admin) => {
            setAdmins((previous) => [...previous, admin]);
            setCreating(false);
          }}
        />
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12 text-ink/70">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <ul className="space-y-3">
          {admins.map((admin) => (
            <li
              key={admin.id}
              className="rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
                    <span className="truncate">{admin.name}</span>
                    {admin.isSelf ? (
                      <span className="shrink-0 rounded-full bg-moss/10 px-1.5 py-0.5 text-[10px] font-medium text-moss dark:bg-sea/15 dark:text-sea">
                        {t("admins.you")}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink/70 dark:text-white/70">{admin.email}</p>
                </div>
                {admin.isSelf ? null : (
                  <button
                    type="button"
                    onClick={() => setDemoting(admin)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink/70 transition hover:border-alert/40 hover:text-alert dark:border-white/10 dark:text-white/70"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    {t("admins.demote")}
                  </button>
                )}
              </div>

              <PermissionGrid
                permissions={admin.permissions}
                // Nobody edits their own access here — the server refuses it, so
                // the UI shows why instead of offering a control that fails.
                disabled={admin.isSelf}
                onToggle={(permission, next) => togglePermission(admin, permission, next)}
              />
              {admin.isSelf ? (
                <p className="mt-2 text-xs text-ink/60 dark:text-white/60">{t("admins.selfNote")}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {demoting ? (
        <ConfirmDialog

          title={t("admins.demoteTitle")}
          message={`${demoting.name} — ${demoting.email}`}
          confirmLabel={t("admins.demote")}
          onConfirm={() => demote(demoting)}
          onClose={() => setDemoting(null)}
        />
      ) : null}
    </div>
  );
}

function NewAdminForm({
  onCancel,
  onCreated
}: {
  onCancel: () => void;
  onCreated: (admin: AdminAccount) => void;
}) {
  const { token } = useAuth();
  const { t } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await createAdminAccount({ name, email, password, permissions }, token);
      onCreated(result.admin);
    } catch (createError) {
      setError(createError instanceof ApiClientError ? createError.message : t("admins.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink dark:text-white">{t("admins.newTitle")}</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("admins.cancel")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 transition hover:bg-ink/5 hover:text-ink dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("admins.name")}
          required
          minLength={2}
          maxLength={120}
          dir="auto"
          className={inputClass}
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("admins.email")}
          required
          dir="ltr"
          className={inputClass}
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t("admins.password")}
          required
          minLength={6}
          maxLength={128}
          dir="ltr"
          className={inputClass}
        />
      </div>

      <PermissionGrid
        permissions={permissions}
        onToggle={(permission, next) =>
          setPermissions((previous) =>
            next ? [...previous, permission] : previous.filter((value) => value !== permission)
          )
        }
      />

      {error ? <p className="mt-3 text-xs font-medium text-alert">{error}</p> : null}

      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={saving} className={buttonClass("primary")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t("admins.create")}
        </button>
      </div>
    </form>
  );
}

/** The permission checkboxes, shared by the create form and every row. */
function PermissionGrid({
  permissions,
  disabled = false,
  onToggle
}: {
  permissions: AdminPermission[];
  disabled?: boolean;
  onToggle: (permission: AdminPermission, next: boolean) => void;
}) {
  const { t } = useLang();

  return (
    <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
      {ADMIN_PERMISSIONS.map((permission) => {
        const checked = permissions.includes(permission);
        return (
          <label
            key={permission}
            className={clsx(
              "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition",
              disabled && "cursor-not-allowed opacity-60",
              checked
                ? "border-moss/40 bg-moss/[0.06] dark:border-sea/40 dark:bg-sea/10"
                : "border-line hover:border-moss/30 dark:border-white/10"
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(event) => onToggle(permission, event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-moss"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-ink dark:text-white">
                {t(`perm.${permission}` as never)}
              </span>
              <span className="block text-[11px] leading-snug text-ink/70 dark:text-white/70">
                {t(`perm.${permission}.desc` as never)}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

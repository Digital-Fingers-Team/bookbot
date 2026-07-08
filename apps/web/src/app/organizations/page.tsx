"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Plus, ShieldPlus, Trash2, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  assignOrgAdmin,
  createOrganization,
  deleteOrganization,
  getCategories,
  grantOrgCatalog,
  listOrganizations,
  listUsers,
  revokeOrgCatalog,
  type CatalogBook,
  type Organization
} from "@/lib/api";
import { BookPicker } from "@/components/book-picker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useT } from "@/lib/i18n";

export default function OrganizationsPage() {
  const router = useRouter();
  const { token, isAdmin, loading: authLoading } = useAuth();
  const t = useT();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await listOrganizations(token);
      setOrgs(result.organizations);
    } catch {
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    getCategories(token).then((r) => setCategories(r.categories)).catch(() => undefined);
    refresh();
  }, [authLoading, isAdmin, router, token, refresh]);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      await createOrganization(trimmed, token);
      setName("");
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function grant(org: Organization, type: "book" | "category", value: string) {
    if (!value) return;
    await grantOrgCatalog(org.id, type, value, token);
    await refresh();
  }

  async function revoke(org: Organization, type: "book" | "category", value: string) {
    await revokeOrgCatalog(org.id, type, value, token);
    await refresh();
  }

  async function confirmRemoveOrg() {
    if (!confirmDeleteOrg || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteOrganization(confirmDeleteOrg.id, token);
      setConfirmDeleteOrg(null);
      await refresh();
    } catch {
      setDeleteError(t("org.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink/70 dark:text-white/70">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-2">
      <header className="mb-2 flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-moss dark:text-sea" />
        <h1 className="text-lg font-bold text-ink dark:text-white">{t("org.title")}</h1>
      </header>
      <p className="mb-5 text-sm text-ink/70 dark:text-white/70">{t("org.subtitle")}</p>

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-line bg-white p-2 dark:border-white/10 dark:bg-[#0c0c0e]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && create()}
          placeholder={t("org.namePlaceholder")}
          dir="auto"
          className="h-9 flex-1 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-ink/35 dark:text-white dark:placeholder:text-white/45"
        />
        <button
          type="button"
          onClick={create}
          disabled={!name.trim() || creating}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-moss px-3 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-sea"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t("org.create")}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink/70">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : orgs.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/70 dark:text-white/70">{t("org.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {orgs.map((org) => (
            <OrgCard
              key={org.id}
              org={org}
              categories={categories}
              onGrant={(type, value) => grant(org, type, value)}
              onRevoke={(type, value) => revoke(org, type, value)}
              onRemove={() => {
                setDeleteError("");
                setConfirmDeleteOrg(org);
              }}
              onRefresh={refresh}
              token={token}
            />
          ))}
        </ul>
      )}

      {confirmDeleteOrg ? (
        <ConfirmDialog
          title={t("org.delete")}
          message={t("org.deleteConfirm")}
          busy={deleting}
          error={deleteError}
          onClose={() => (deleting ? undefined : setConfirmDeleteOrg(null))}
          onConfirm={confirmRemoveOrg}
        />
      ) : null}
    </div>
  );
}

function OrgCard({
  org,
  categories,
  onGrant,
  onRevoke,
  onRemove,
  onRefresh,
  token
}: {
  org: Organization;
  categories: string[];
  onGrant: (type: "book" | "category", value: string) => void;
  onRevoke: (type: "book" | "category", value: string) => void;
  onRemove: () => void;
  onRefresh: () => void;
  token: string;
}) {
  const t = useT();
  const [adminEmail, setAdminEmail] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");

  async function assign() {
    const email = adminEmail.trim();
    if (!email || assigning) return;
    setAssigning(true);
    setAssignMsg("");
    try {
      const { users } = await listUsers(token, email);
      const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!match) {
        setAssignMsg(t("org.assignError"));
        return;
      }
      await assignOrgAdmin(org.id, match.id, token);
      setAdminEmail("");
      setAssignMsg(t("org.assignSuccess"));
      onRefresh();
    } catch {
      setAssignMsg(t("org.assignError"));
    } finally {
      setAssigning(false);
    }
  }

  return (
    <li className="rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-ink dark:text-white">{org.name}</p>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-ink/70 dark:text-white/70">
            {org.studentCount} {t("org.students")} · {org.adminCount} {t("org.admins")}
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("org.delete")}
            title={t("org.delete")}
            className="text-ink/40 transition hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <AccessSection
          label={t("users.categories")}
          chips={org.allowedCategories.map((c) => ({ value: c, label: c }))}
          options={categories.filter((c) => !org.allowedCategories.includes(c)).map((c) => ({ value: c, label: c }))}
          onAdd={(v) => onGrant("category", v)}
          onRemove={(v) => onRevoke("category", v)}
        />

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/70">
            {t("users.books")}
          </p>
          <div className="mb-2 space-y-1.5">
            {org.allowedBooks.length === 0 ? (
              <p className="text-xs text-ink/35 dark:text-white/35">{t("org.noBooks")}</p>
            ) : (
              org.allowedBooks.map((book) => (
                <div
                  key={book.id}
                  className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 dark:border-white/10"
                >
                  <span dir="auto" className="min-w-0 flex-1 truncate text-xs font-medium text-ink dark:text-white">
                    {book.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRevoke("book", book.id)}
                    aria-label="remove"
                    className="shrink-0 text-ink/40 transition hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          <BookPicker size="sm" excludeIds={org.allowedBooks.map((b) => b.id)} onPick={(book: CatalogBook) => onGrant("book", book.id)} />
        </div>

        <div className="border-t border-line pt-3 dark:border-white/10">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/70">
            {t("org.assignAdmin")}
          </p>
          <div className="flex items-center gap-2">
            <input
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && assign()}
              placeholder={t("org.assignAdminEmail")}
              className="h-9 flex-1 rounded-lg border border-line bg-white px-2.5 text-sm text-ink outline-none placeholder:text-ink/35 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/45"
            />
            <button
              type="button"
              onClick={assign}
              disabled={!adminEmail.trim() || assigning}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink/70 transition hover:text-moss disabled:opacity-50 dark:border-white/10 dark:text-white/80"
            >
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldPlus className="h-4 w-4" />}
              {t("org.assign")}
            </button>
          </div>
          {assignMsg ? <p className="mt-1.5 text-xs text-ink/70 dark:text-white/75">{assignMsg}</p> : null}
        </div>
      </div>
    </li>
  );
}

type Option = { value: string; label: string };

function AccessSection({
  label,
  chips,
  options,
  onAdd,
  onRemove
}: {
  label: string;
  chips: Option[];
  options: Option[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/80">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.length === 0 ? <span className="text-xs text-ink/35 dark:text-white/55">—</span> : null}
        {chips.map((chip) => (
          <span
            key={chip.value}
            dir="auto"
            className="inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-moss/10 py-0.5 pe-1 ps-2 text-[11px] font-medium text-moss dark:bg-sea/15 dark:text-sea"
          >
            <span className="truncate">{chip.label}</span>
            <button type="button" onClick={() => onRemove(chip.value)} aria-label="remove" className="hover:text-red-500">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {adding ? (
          <select
            autoFocus
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) onAdd(event.target.value);
              setAdding(false);
            }}
            onBlur={() => setAdding(false)}
            dir="auto"
            className="h-7 rounded-full border border-line bg-white px-2 text-[11px] text-ink outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            <option value="">…</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-medium text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/15 dark:text-white/80"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

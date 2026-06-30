"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getCategories, grantAccess, listUsers, revokeAccess, type AdminUser, type CatalogBook } from "@/lib/api";
import { BookPicker } from "@/components/book-picker";
import { useT } from "@/lib/i18n";

export default function UsersPage() {
  const router = useRouter();
  const { token, isAdmin, loading: authLoading } = useAuth();
  const t = useT();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await listUsers(token, search.trim() || undefined);
      setUsers(result.users);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    getCategories(token).then((r) => setCategories(r.categories)).catch(() => undefined);
  }, [authLoading, isAdmin, router, token]);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  async function grant(user: AdminUser, type: "book" | "category", value: string) {
    if (!value) return;
    await grantAccess(user.id, type, value, token);
    await refresh();
  }

  async function revoke(user: AdminUser, type: "book" | "category", value: string) {
    await revokeAccess(user.id, type, value, token);
    await refresh();
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink/40 dark:text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-2">
      <header className="mb-5 flex items-center gap-2">
        <Users className="h-5 w-5 text-moss dark:text-sea" />
        <h1 className="text-lg font-bold text-ink dark:text-white">{t("users.title")}</h1>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-white px-3 dark:border-white/10 dark:bg-[#0c0c0e]">
        <Search className="h-4 w-4 text-ink/40" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("users.search")}
          className="h-10 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/35 dark:text-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/45 dark:text-white/45">{t("users.empty")}</p>
      ) : (
        <>
        {users.length >= 200 ? (
          <p className="mb-3 rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
            {t("users.truncated")}
          </p>
        ) : null}
        <ul className="space-y-3">
          {users.map((user) => (
            <li key={user.id} className="rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink dark:text-white">{user.name}</p>
                  <p className="truncate text-xs text-ink/50 dark:text-white/50">{user.email}</p>
                </div>
                {user.role === "admin" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-moss/10 px-2 py-0.5 text-[11px] font-medium text-moss dark:bg-sea/15 dark:text-sea">
                    <ShieldCheck className="h-3 w-3" />
                    {t("role.admin")}
                  </span>
                ) : null}
              </div>

              {user.role === "admin" ? (
                <p className="mt-3 text-xs text-ink/45 dark:text-white/45">{t("users.adminFull")}</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <AccessSection
                    label={t("users.categories")}
                    chips={user.allowedCategories.map((c) => ({ value: c, label: c }))}
                    options={categories.filter((c) => !user.allowedCategories.includes(c)).map((c) => ({ value: c, label: c }))}
                    onAdd={(v) => grant(user, "category", v)}
                    onRemove={(v) => revoke(user, "category", v)}
                  />
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40 dark:text-white/40">
                      {t("users.books")}
                    </p>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      {user.allowedBooks.length === 0 ? (
                        <span className="text-xs text-ink/35 dark:text-white/35">—</span>
                      ) : null}
                      {user.allowedBooks.map((book) => (
                        <span
                          key={book.id}
                          dir="auto"
                          className="inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-moss/10 py-0.5 pe-1 ps-2 text-[11px] font-medium text-moss dark:bg-sea/15 dark:text-sea"
                        >
                          <span className="truncate">{book.title}</span>
                          <button
                            type="button"
                            onClick={() => revoke(user, "book", book.id)}
                            aria-label="remove"
                            className="hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <BookPicker
                      size="sm"
                      excludeIds={user.allowedBooks.map((b) => b.id)}
                      onPick={(book: CatalogBook) => grant(user, "book", book.id)}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
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
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40 dark:text-white/40">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.length === 0 ? <span className="text-xs text-ink/35 dark:text-white/35">—</span> : null}
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
            className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-medium text-ink/50 transition hover:border-moss/40 hover:text-moss dark:border-white/15 dark:text-white/50"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

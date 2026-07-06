"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  addOrgStudent,
  getMyOrganization,
  grantStudentAccess,
  listOrgStudents,
  removeOrgStudent,
  revokeStudentAccess,
  setStudentDownloadAccess,
  type MyOrganization,
  type OrgStudent
} from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n";

export default function OrgStudentsPage() {
  const router = useRouter();
  const { token, isOrgAdmin, loading: authLoading } = useAuth();
  const t = useT();
  const [org, setOrg] = useState<MyOrganization | null>(null);
  const [students, setStudents] = useState<OrgStudent[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloadBusyKey, setDownloadBusyKey] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await listOrgStudents(token, search.trim() || undefined);
      setStudents(result.students);
      setCursor(result.nextCursor);
    } catch {
      setStudents([]);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  const loadMore = useCallback(async () => {
    if (!token || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await listOrgStudents(token, search.trim() || undefined, cursor);
      setStudents((prev) => [...prev, ...result.students]);
      setCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [token, search, cursor, loadingMore]);

  useEffect(() => {
    if (authLoading) return;
    if (!isOrgAdmin) {
      router.replace("/");
      return;
    }
    getMyOrganization(token).then(setOrg).catch(() => setOrg(null));
  }, [authLoading, isOrgAdmin, router, token]);

  useEffect(() => {
    if (isOrgAdmin) refresh();
  }, [isOrgAdmin, refresh]);

  async function addStudent() {
    const trimmed = email.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    setAddError("");
    try {
      await addOrgStudent(trimmed, token);
      setEmail("");
      await refresh();
    } catch {
      setAddError(t("orgAdmin.addError"));
    } finally {
      setAdding(false);
    }
  }

  async function grant(student: OrgStudent, type: "book" | "category", value: string) {
    if (!value) return;
    await grantStudentAccess(student.id, type, value, token);
    await refresh();
  }

  async function revoke(student: OrgStudent, type: "book" | "category", value: string) {
    await revokeStudentAccess(student.id, type, value, token);
    await refresh();
  }

  async function remove(student: OrgStudent) {
    await removeOrgStudent(student.id, token);
    await refresh();
  }

  async function toggleDownload(student: OrgStudent, book: OrgStudent["allowedBooks"][number]) {
    const key = `${student.id}:${book.id}`;
    const next = !book.canDownload;
    setDownloadBusyKey(key);
    try {
      await setStudentDownloadAccess(student.id, book.id, next, token);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? { ...s, allowedBooks: s.allowedBooks.map((b) => (b.id === book.id ? { ...b, canDownload: next } : b)) }
            : s
        )
      );
    } finally {
      setDownloadBusyKey("");
    }
  }

  if (authLoading || !isOrgAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink/70 dark:text-white/70">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const catalogCategories = org?.allowedCategories ?? [];
  const catalogBooks = org?.allowedBooks ?? [];

  return (
    <div className="mx-auto max-w-3xl py-2">
      <header className="mb-2 flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-moss dark:text-sea" />
        <h1 className="text-lg font-bold text-ink dark:text-white">{org?.name ?? t("orgAdmin.title")}</h1>
      </header>
      <p className="mb-5 text-sm text-ink/70 dark:text-white/70">{t("orgAdmin.subtitle")}</p>

      <div className="mb-5 rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/70">
          {t("orgAdmin.catalogTitle")}
        </p>
        {catalogCategories.length === 0 && catalogBooks.length === 0 ? (
          <p className="text-xs text-ink/35 dark:text-white/35">{t("orgAdmin.noCatalog")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {catalogCategories.map((c) => (
              <span
                key={c}
                dir="auto"
                className="rounded-full bg-moss/10 px-2 py-0.5 text-[11px] font-medium text-moss dark:bg-sea/15 dark:text-sea"
              >
                {c}
              </span>
            ))}
            {catalogBooks.map((b) => (
              <span
                key={b.id}
                dir="auto"
                className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-ink/70 dark:border-white/10 dark:text-white/70"
              >
                {b.title}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/70">
          {t("orgAdmin.addStudent")}
        </p>
        <div className="flex items-center gap-2">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addStudent()}
            placeholder={t("orgAdmin.studentEmail")}
            className="h-10 flex-1 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none placeholder:text-ink/35 dark:border-white/10 dark:bg-[#0c0c0e] dark:text-white dark:placeholder:text-white/45"
          />
          <button
            type="button"
            onClick={addStudent}
            disabled={!email.trim() || adding}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-moss px-3 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-sea"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("orgAdmin.add")}
          </button>
        </div>
        {addError ? <p className="mt-1.5 text-xs text-red-500">{addError}</p> : null}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-white px-3 dark:border-white/10 dark:bg-[#0c0c0e]">
        <Search className="h-4 w-4 text-ink/70" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("users.search")}
          className="h-10 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/35 dark:text-white dark:placeholder:text-white/45"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink/70">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : students.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/70 dark:text-white/70">{t("orgAdmin.empty")}</p>
      ) : (
        <>
          <ul className="space-y-3">
            {students.map((student) => (
              <li key={student.id} className="rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink dark:text-white">{student.name}</p>
                    <p className="truncate text-xs text-ink/70 dark:text-white/70">{student.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(student)}
                    className="shrink-0 text-xs font-medium text-ink/40 transition hover:text-red-500"
                  >
                    {t("orgAdmin.remove")}
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  <AccessSection
                    label={t("users.categories")}
                    chips={student.allowedCategories.map((c) => ({ value: c, label: c }))}
                    options={catalogCategories
                      .filter((c) => !student.allowedCategories.includes(c))
                      .map((c) => ({ value: c, label: c }))}
                    onAdd={(v) => grant(student, "category", v)}
                    onRemove={(v) => revoke(student, "category", v)}
                  />
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/70">
                      {t("users.books")}
                    </p>
                    <div className="mb-2 space-y-1.5">
                      {student.allowedBooks.length === 0 ? (
                        <p className="text-xs text-ink/35 dark:text-white/35">{t("users.noBooks")}</p>
                      ) : (
                        student.allowedBooks.map((book) => (
                          <div
                            key={book.id}
                            className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 dark:border-white/10"
                          >
                            <span dir="auto" className="min-w-0 flex-1 truncate text-xs font-medium text-ink dark:text-white">
                              {book.title}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              <span className="text-[11px] text-ink/70 dark:text-white/70">{t("users.canDownload")}</span>
                              <Switch
                                checked={book.canDownload}
                                disabled={downloadBusyKey === `${student.id}:${book.id}`}
                                onChange={() => toggleDownload(student, book)}
                                label={t("users.canDownload")}
                              />
                            </span>
                            <button
                              type="button"
                              onClick={() => revoke(student, "book", book.id)}
                              aria-label="remove"
                              className="shrink-0 text-ink/40 transition hover:text-red-500"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <AccessSection
                      label=""
                      chips={[]}
                      options={catalogBooks
                        .filter((b) => !student.allowedBooks.some((sb) => sb.id === b.id))
                        .map((b) => ({ value: b.id, label: b.title }))}
                      onAdd={(v) => grant(student, "book", v)}
                      onRemove={() => undefined}
                      hideChips
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {cursor ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/70 transition hover:text-moss disabled:opacity-50 dark:border-white/10 dark:text-white/70"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("common.loadMore")}
              </button>
            </div>
          ) : null}
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
  onRemove,
  hideChips = false
}: {
  label: string;
  chips: Option[];
  options: Option[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  hideChips?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      {label ? (
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/70">{label}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {!hideChips && chips.length === 0 ? <span className="text-xs text-ink/35 dark:text-white/35">—</span> : null}
        {!hideChips &&
          chips.map((chip) => (
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
        {options.length === 0 ? null : adding ? (
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
            className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-medium text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/15 dark:text-white/70"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Plus, ShieldPlus, Trash2, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  ApiClientError,
  assignOrgAdmin,
  createOrganization,
  deleteOrganization,
  getCategories,
  getOrganizationCurrentIp,
  grantOrgCatalog,
  listOrganizations,
  listUsers,
  revokeOrgCatalog,
  setBookQuota,
  testOrganizationNetworkPolicy,
  updateOrganizationNetworkPolicy,
  type CatalogBook,
  type Organization
} from "@/lib/api";
import { BookPicker } from "@/components/book-picker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useT } from "@/lib/i18n";

const nf = new Intl.NumberFormat("en");

export default function OrganizationsPage() {
  const router = useRouter();
  const { token, isAdmin, loading: authLoading, logout } = useAuth();
  const t = useT();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
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
    setCreateError("");
    try {
      await createOrganization(trimmed, token);
      setName("");
      await refresh();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        // A cached JWT can outlive the API instance that issued it.
        logout();
        router.replace("/login");
        return;
      }
      setCreateError(error instanceof ApiClientError ? error.message : t("org.createError"));
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
      {createError ? <p className="-mt-3 mb-4 text-sm text-red-500">{createError}</p> : null}

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
                  <span dir="auto" className="flex min-w-0 flex-1 items-baseline gap-1.5 truncate">
                    <span className="truncate text-xs font-medium text-ink dark:text-white">{book.title}</span>
                    {book.price > 0 ? (
                      <span className="shrink-0 text-[11px] text-ink/50 dark:text-white/50">
                        ({nf.format(book.price)} {t("common.currency")})
                      </span>
                    ) : null}
                  </span>
                  <BookQuotaEditor orgId={org.id} book={book} onSaved={onRefresh} token={token} />
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

        <NetworkPolicyEditor org={org} token={token} onSaved={onRefresh} />

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

function NetworkPolicyEditor({ org, token, onSaved }: { org: Organization; token: string; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(org.networkRestrictionEnabled);
  const [cidrs, setCidrs] = useState(org.allowedIpCidrs);
  const [input, setInput] = useState("");
  const [currentIp, setCurrentIp] = useState(org.lastObservedIp ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(org.networkRestrictionEnabled);
    setCidrs(org.allowedIpCidrs);
    setCurrentIp(org.lastObservedIp ?? "");
  }, [org.networkRestrictionEnabled, org.allowedIpCidrs, org.lastObservedIp]);

  async function save(nextCidrs = cidrs, nextEnabled = enabled, nextDownloads = org.downloadableBookIds) {
    setBusy(true);
    setStatus("");
    try {
      await updateOrganizationNetworkPolicy(org.id, {
        networkRestrictionEnabled: nextEnabled,
        allowedIpCidrs: nextCidrs,
        downloadableBookIds: nextDownloads
      }, token);
      setCidrs(nextCidrs);
      setEnabled(nextEnabled);
      setStatus("Saved");
      onSaved();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save network policy.");
    } finally {
      setBusy(false);
    }
  }

  async function addNetwork(value = input) {
    const trimmed = value.trim();
    if (!trimmed || cidrs.includes(trimmed)) return;
    setInput("");
    await save([...cidrs, trimmed]);
  }

  async function removeNetwork(value: string) {
    await save(cidrs.filter((cidr) => cidr !== value));
  }

  async function toggleDownload(bookId: string) {
    const downloads = org.downloadableBookIds.includes(bookId)
      ? org.downloadableBookIds.filter((id) => id !== bookId)
      : [...org.downloadableBookIds, bookId];
    await save(cidrs, enabled, downloads);
  }

  async function detectIp() {
    setBusy(true);
    try {
      const result = await getOrganizationCurrentIp(org.id, token);
      setCurrentIp(result.ip);
      setStatus(`Current IP: ${result.ip}`);
      onSaved();
    } catch {
      setStatus("Could not detect current IP.");
    } finally {
      setBusy(false);
    }
  }

  async function testIp() {
    setBusy(true);
    try {
      const result = await testOrganizationNetworkPolicy(org.id, currentIp || undefined, token);
      setStatus(result.allowed ? `Allowed (${result.matchedCidrs.join(", ")})` : "Not allowed");
    } catch {
      setStatus("Could not test IP.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-line pt-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/70">Network access</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => save(cidrs, !enabled)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${enabled ? "bg-moss text-white dark:bg-sea" : "bg-black/10 text-ink/70 dark:bg-white/10 dark:text-white/70"}`}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      </div>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {cidrs.map((cidr) => (
            <span key={cidr} className="inline-flex items-center gap-1 rounded-md bg-moss/10 px-2 py-1 text-xs text-moss dark:bg-sea/15 dark:text-sea">
              {cidr}
              <button type="button" disabled={busy} onClick={() => removeNetwork(cidr)} aria-label={`Remove ${cidr}`}>×</button>
            </span>
          ))}
          {!cidrs.length ? <span className="text-xs text-ink/45 dark:text-white/45">No allowed networks</span> : null}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void addNetwork()}
            placeholder="Public IP or CIDR"
            className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-transparent px-2 text-xs outline-none dark:border-white/10"
          />
          <button type="button" disabled={busy || !input.trim()} onClick={() => void addNetwork()} className="rounded-lg border border-line px-2 text-xs dark:border-white/10">Add</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/65 dark:text-white/65">
          <span>Current IP: {currentIp || "—"}</span>
          <button type="button" disabled={busy} onClick={() => void detectIp()} className="underline">Detect</button>
          <button type="button" disabled={busy} onClick={() => void testIp()} className="underline">Test</button>
          {status ? <span>{status}</span> : null}
        </div>
        {org.allowedBooks.length ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-ink/70 dark:text-white/70">Network downloads</p>
            {org.allowedBooks.map((book) => (
              <label key={book.id} className="flex items-center gap-2 text-xs text-ink/70 dark:text-white/70">
                <input type="checkbox" checked={org.downloadableBookIds.includes(book.id)} disabled={busy} onChange={() => void toggleDownload(book.id)} />
                <span className="truncate">{book.title}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BookQuotaEditor({
  orgId,
  book,
  onSaved,
  token
}: {
  orgId: string;
  book: Organization["allowedBooks"][number];
  onSaved: () => void;
  token: string;
}) {
  const t = useT();
  const [value, setValue] = useState(book.quota == null ? "" : String(book.quota));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setValue(book.quota == null ? "" : String(book.quota));
  }, [book.quota]);

  const parsedValue = Number(value.trim());
  const total =
    book.price > 0 && value.trim() !== "" && Number.isInteger(parsedValue) && parsedValue >= 0
      ? parsedValue * book.price
      : null;

  async function save() {
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
      setError(true);
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await setBookQuota(orgId, book.id, parsed, token);
      onSaved();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="flex shrink-0 items-center gap-1" title={t("org.quota")}>
      <span className="text-[11px] text-ink/50 dark:text-white/50">{book.granted}/</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => event.key === "Enter" && save()}
        placeholder={t("org.quotaPlaceholder")}
        aria-label={t("org.quota")}
        className="h-6 w-14 rounded border border-line bg-white px-1 text-[11px] text-ink outline-none placeholder:text-ink/35 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/45"
      />
      {total != null ? (
        <span className="text-[11px] font-semibold text-moss dark:text-sea">
          = {nf.format(total)} {t("common.currency")}
        </span>
      ) : null}
      {saving ? <Loader2 className="h-3 w-3 animate-spin text-ink/40" /> : null}
      {error ? <span className="text-[11px] text-red-500">{t("org.quotaError")}</span> : null}
    </span>
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

"use client";

import { KeyRound } from "lucide-react";
import { useAdminKey } from "@/hooks/use-admin-key";

export function AdminKeyField() {
  const { adminKey, setAdminKey } = useAdminKey();

  return (
    <label className="flex w-full flex-col gap-2 text-sm font-medium text-ink dark:text-white sm:max-w-sm">
      Admin key
      <span className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/8">
        <KeyRound className="h-4 w-4 text-ink/45 dark:text-white/45" />
        <input
          value={adminKey}
          onChange={(event) => setAdminKey(event.target.value)}
          type="password"
          placeholder="Required for upload, delete, and stats"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink/35 dark:placeholder:text-white/35"
        />
      </span>
    </label>
  );
}

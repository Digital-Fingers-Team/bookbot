"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import {
  getMyBooks,
  getShowcaseBooks,
  getSupportThread,
  listSupportThreads,
  supportUnreadCount,
  type SupportThreadFilters
} from "./api";

/**
 * Typed data hooks backed by TanStack Query. Pages use these instead of
 * hand-rolling useState/useEffect/fetch, getting caching, dedup, background
 * refetch and consistent loading/error state for free.
 */
export function useMyBooks() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["my-books", token],
    queryFn: () => getMyBooks(token),
    enabled: Boolean(token)
  });
}

export function useShowcaseBooks(count = 12) {
  return useQuery({
    queryKey: ["showcase-books", count],
    queryFn: () => getShowcaseBooks(count),
    staleTime: 60_000
  });
}

/**
 * Support messaging. Both sides poll: a conversation is only useful if the
 * other party's reply appears without a manual refresh. The thread list carries
 * summary rows only, and an open thread polls faster than the list behind it.
 */
export function useSupportThreads(filters: SupportThreadFilters = {}) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["support-threads", token, filters],
    queryFn: () => listSupportThreads(token, filters),
    enabled: Boolean(token),
    refetchInterval: 30_000
  });
}

export function useSupportThread(id: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["support-thread", token, id],
    queryFn: () => getSupportThread(id as string, token),
    enabled: Boolean(token && id),
    refetchInterval: 15_000
  });
}

export function useSupportUnreadCount() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["support-unread", token],
    queryFn: () => supportUnreadCount(token),
    enabled: Boolean(token),
    refetchInterval: 60_000
  });
}

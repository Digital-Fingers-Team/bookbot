"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { getMyBooks, getShowcaseBooks } from "./api";

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

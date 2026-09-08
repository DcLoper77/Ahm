"use client";

import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { useAdminSession } from "@/components/auth/session-context";

export function useAdminQuery<T>(
  queryKey: readonly unknown[],
  queryFn: (api: ReturnType<typeof useAdminSession>["api"]) => Promise<T>,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">,
): UseQueryResult<T> {
  const { api, status } = useAdminSession();
  return useQuery({
    queryKey,
    queryFn: () => queryFn(api),
    enabled: status === "authenticated" && (options?.enabled ?? true),
    ...options,
  });
}

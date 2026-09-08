"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AdminApiClient, createIdempotencyKey, type ApiResult } from "@/lib/admin/client";
import { createAdminApi, type AdminAuthApi, type AdminResourceApi } from "@/lib/admin/api";
import { AdminApiError } from "@/lib/admin/errors";
import type { AdminLoginBody } from "@/lib/admin/bodies";
import type { AdminMe, MutationInput } from "@/lib/admin/types";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface StepUpCredentials {
  email: string;
  password: string;
  totp_code?: string;
  recovery_code?: string;
}

export interface StepUpPrompt {
  action: string;
  email: string;
  continue: (credentials: StepUpCredentials) => Promise<void>;
  cancel: () => void;
}

export interface AdminNotice {
  kind: "info" | "warning" | "success";
  title: string;
  message: string;
  requestId?: string;
}

interface AdminSessionContextValue {
  status: SessionStatus;
  admin: AdminMe | null;
  api: AdminAuthApi & AdminResourceApi;
  client: AdminApiClient;
  sessionIdleExpiresAt: string | null;
  notice: AdminNotice | null;
  stepUpPrompt: StepUpPrompt | null;
  signIn: (credentials: AdminLoginBody) => Promise<{ mfa_enrollment_required: boolean }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshMe: () => Promise<AdminMe | null>;
  runMutation: <T>(input: MutationInput) => Promise<ApiResult<T>>;
  dismissNotice: () => void;
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

function safeReturnPath(): string {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname;
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [client] = useState(() => new AdminApiClient());
  const api = useMemo(() => createAdminApi(client), [client]);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [notice, setNotice] = useState<AdminNotice | null>(null);
  const [stepUpPrompt, setStepUpPrompt] = useState<StepUpPrompt | null>(null);
  const [idleExpiresAt, setIdleExpiresAt] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  const expireSession = useCallback(() => {
    queryClient.clear();
    setAdmin(null);
    setIdleExpiresAt(null);
    setStatus("unauthenticated");
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/invite")
    ) {
      const returnPath = encodeURIComponent(safeReturnPath());
      window.location.replace(`/login?returnTo=${returnPath}`);
    }
  }, [queryClient]);

  const refreshMe = useCallback(async (): Promise<AdminMe | null> => {
    try {
      const result = await api.me();
      setAdmin(result.data);
      setStatus("authenticated");
      return result.data;
    } catch (error) {
      if (error instanceof AdminApiError && error.code === "ADMIN_SESSION_EXPIRED") {
        expireSession();
        return null;
      }
      setAdmin(null);
      setStatus("unauthenticated");
      return null;
    }
  }, [api, expireSession]);

  useEffect(() => {
    client.setHooks({
      onSessionExpired: () => expireSession(),
      onPermissionDenied: (error) => {
        setNotice({
          kind: "warning",
          title: "Permission changed",
          message: "Your role snapshot was refreshed. The requested action is unavailable.",
          requestId: error.requestId,
        });
        void refreshMe();
      },
    });
  }, [client, expireSession, refreshMe]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void refreshMe();
  }, [refreshMe]);

  const signIn = useCallback(
    async (credentials: AdminLoginBody) => {
      const result = await api.login(credentials);
      setIdleExpiresAt(result.data.idle_expires_at);
      const me = await api.me();
      setAdmin(me.data);
      setStatus("authenticated");
      return { mfa_enrollment_required: result.data.mfa_enrollment_required };
    },
    [api],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Expired sessions are already effectively logged out.
    } finally {
      queryClient.clear();
      setAdmin(null);
      setIdleExpiresAt(null);
      setStatus("unauthenticated");
    }
  }, [api, queryClient]);

  const refreshSession = useCallback(async () => {
    const result = await api.refresh();
    setIdleExpiresAt(result.data.idle_expires_at);
    await refreshMe();
  }, [api, refreshMe]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const timer = window.setInterval(
      () => {
        void refreshSession();
      },
      30 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [refreshSession, status]);

  const runMutation = useCallback(
    async <T,>(input: MutationInput): Promise<ApiResult<T>> => {
      const idempotencyKey = input.idempotency_key ?? createIdempotencyKey();
      const execute = () =>
        client.request<T>(input.path, {
          method: input.method ?? "POST",
          body: input.body,
          idempotencyKey,
        });

      try {
        return await execute();
      } catch (error) {
        if (!(error instanceof AdminApiError) || error.code !== "STEP_UP_REQUIRED") throw error;

        const details = error.details;
        const requestedAction =
          details &&
          typeof details === "object" &&
          typeof (details as { action?: unknown }).action === "string"
            ? String((details as { action: string }).action)
            : (input.step_up_action ?? "admin:protected_action");

        return await new Promise<ApiResult<T>>((resolve, reject) => {
          const prompt: StepUpPrompt = {
            action: requestedAction,
            email: admin?.email ?? "",
            continue: async (credentials) => {
              try {
                const login = await api.login(credentials);
                if (login.data.mfa_enrollment_required) {
                  throw new AdminApiError({
                    code: "ADMIN_MFA_REQUIRED",
                    status: 401,
                    message: "Complete MFA enrollment before continuing.",
                  });
                }
                const me = await api.me();
                setAdmin(me.data);
                setStatus("authenticated");
                resolve(await execute());
              } catch (stepUpError) {
                reject(stepUpError);
              } finally {
                setStepUpPrompt(null);
              }
            },
            cancel: () => {
              setStepUpPrompt(null);
              reject(new Error("Step-up verification was cancelled."));
            },
          };
          setStepUpPrompt(prompt);
        });
      }
    },
    [admin?.email, api, client],
  );

  const value = useMemo<AdminSessionContextValue>(
    () => ({
      status,
      admin,
      api,
      client,
      sessionIdleExpiresAt: idleExpiresAt,
      notice,
      stepUpPrompt,
      signIn,
      signOut,
      refreshSession,
      refreshMe,
      runMutation,
      dismissNotice: () => setNotice(null),
    }),
    [
      admin,
      api,
      client,
      idleExpiresAt,
      notice,
      refreshMe,
      refreshSession,
      runMutation,
      signIn,
      signOut,
      status,
      stepUpPrompt,
    ],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionContextValue {
  const value = useContext(AdminSessionContext);
  if (!value) throw new Error("useAdminSession must be used inside AdminSessionProvider");
  return value;
}

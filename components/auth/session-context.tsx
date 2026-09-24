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

type SessionStatus = "loading" | "authenticated" | "unauthenticated" | "error";

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
  startupError: AdminApiError | null;
  admin: AdminMe | null;
  api: AdminAuthApi & AdminResourceApi;
  client: AdminApiClient;
  sessionIdleExpiresAt: string | null;
  notice: AdminNotice | null;
  stepUpPrompt: StepUpPrompt | null;
  signIn: (credentials: AdminLoginBody) => Promise<{ mfa_enrollment_required: boolean }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  retrySession: () => Promise<void>;
  refreshMe: () => Promise<AdminMe | null>;
  runMutation: <T, TBody = unknown>(input: MutationInput<TBody>) => Promise<ApiResult<T>>;
  dismissNotice: () => void;
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

function safeReturnPath(): string {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname;
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableValue(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function mutationFingerprint<TBody>(input: MutationInput<TBody>): Promise<string> {
  const method = input.method ?? "POST";
  const body = stableValue(input.body ?? null);
  const source = `${method}\n${input.path}\n${body}`;
  if (!globalThis.crypto?.subtle) return `${method}:${input.path}`;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return `${method}:${input.path}:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [client] = useState(() => new AdminApiClient());
  const api = useMemo(() => createAdminApi(client), [client]);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [startupError, setStartupError] = useState<AdminApiError | null>(null);
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [notice, setNotice] = useState<AdminNotice | null>(null);
  const [stepUpPrompt, setStepUpPrompt] = useState<StepUpPrompt | null>(null);
  const [idleExpiresAt, setIdleExpiresAt] = useState<string | null>(null);
  const bootstrapped = useRef(false);
  const unresolvedMutationKeys = useRef(new Map<string, string>());

  const expireSession = useCallback(() => {
    client.clearCsrfToken();
    unresolvedMutationKeys.current.clear();
    queryClient.clear();
    setAdmin(null);
    setIdleExpiresAt(null);
    setStartupError(null);
    setStatus("unauthenticated");
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/invite")
    ) {
      const returnPath = encodeURIComponent(safeReturnPath());
      window.location.replace(`/login?returnTo=${returnPath}`);
    }
  }, [client, queryClient]);

  const refreshMe = useCallback(async (): Promise<AdminMe | null> => {
    try {
      const result = await api.me();
      setAdmin(result.data);
      setStartupError(null);
      setStatus("authenticated");
      return result.data;
    } catch (error) {
      if (error instanceof AdminApiError && error.code === "ADMIN_SESSION_EXPIRED") {
        expireSession();
        return null;
      }
      setAdmin(null);
      const normalized =
        error instanceof AdminApiError
          ? error
          : new AdminApiError({ code: "NETWORK_ERROR", status: 0 });
      setStartupError(normalized);
      setStatus("error");
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
      setStartupError(null);
      const result = await api.login(credentials);
      setIdleExpiresAt(result.data.idle_expires_at);
      setStatus("authenticated");
      try {
        const me = await api.me();
        setAdmin(me.data);
        setStartupError(null);
      } catch (error) {
        if (
          !result.data.mfa_enrollment_required ||
          !(error instanceof AdminApiError && error.code === "ADMIN_MFA_REQUIRED")
        ) {
          setAdmin(null);
          setStatus("unauthenticated");
          throw error;
        }
        // Restricted invitation sessions may not be allowed through /auth/me until MFA is enrolled.
        // Keep the authenticated cookie session available to the enrollment route without inventing
        // an incomplete AdminMe object.
        setAdmin(null);
      }
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
      client.clearCsrfToken();
      unresolvedMutationKeys.current.clear();
      queryClient.clear();
      setAdmin(null);
      setIdleExpiresAt(null);
      setStatus("unauthenticated");
    }
  }, [api, client, queryClient]);

  const refreshSession = useCallback(async () => {
    const result = await api.refresh();
    setIdleExpiresAt(result.data.idle_expires_at);
    await refreshMe();
  }, [api, refreshMe]);

  const retrySession = useCallback(async () => {
    setStatus("loading");
    await refreshMe();
  }, [refreshMe]);

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
    async <T, TBody = unknown>(input: MutationInput<TBody>): Promise<ApiResult<T>> => {
      const fingerprint = await mutationFingerprint(input);
      const idempotencyKey =
        input.idempotency_key ??
        unresolvedMutationKeys.current.get(fingerprint) ??
        createIdempotencyKey();
      unresolvedMutationKeys.current.set(fingerprint, idempotencyKey);
      const execute = () =>
        client.request<T>(input.path, {
          method: input.method ?? "POST",
          body: input.body,
          idempotencyKey,
          moneyMoving: input.money_moving,
        });

      try {
        const result = await execute();
        unresolvedMutationKeys.current.delete(fingerprint);
        return result;
      } catch (error) {
        if (!(error instanceof AdminApiError) || error.code !== "STEP_UP_REQUIRED") {
          if (!(error instanceof AdminApiError && error.retryable))
            unresolvedMutationKeys.current.delete(fingerprint);
          throw error;
        }

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
                const result = await execute();
                unresolvedMutationKeys.current.delete(fingerprint);
                resolve(result);
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
      startupError,
      admin,
      api,
      client,
      sessionIdleExpiresAt: idleExpiresAt,
      notice,
      stepUpPrompt,
      signIn,
      signOut,
      refreshSession,
      retrySession,
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
      startupError,
      stepUpPrompt,
      retrySession,
    ],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionContextValue {
  const value = useContext(AdminSessionContext);
  if (!value) throw new Error("useAdminSession must be used inside AdminSessionProvider");
  return value;
}

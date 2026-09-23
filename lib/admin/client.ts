import {
  AdminApiError,
  errorFromEnvelope,
  isRetryableCode,
  parseRetryAfter,
  safeMessageForCode,
} from "./errors";
import type { AdminErrorBody, AdminListQuery, MutationMethod } from "./types";

export const ADMIN_API_PREFIX = "/admin/v1";

export interface ApiResult<T> {
  data: T;
  request_id: string;
}

export interface AdminClientHooks {
  onSessionExpired?: (error: AdminApiError) => void;
  onPermissionDenied?: (error: AdminApiError) => void;
}

export interface RequestOptions<TBody = unknown> {
  method?: MutationMethod | "GET";
  query?: AdminListQuery;
  body?: TBody;
  idempotencyKey?: string;
  requiresIdempotency?: boolean;
  requiresCsrf?: boolean;
  retryNetwork?: boolean;
  /** Set for provider correction or another money-moving action. Such requests are never
   * automatically retried after a transport failure. */
  moneyMoving?: boolean;
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function defaultBaseUrl(): string {
  return "";
}

function normalizeBaseUrl(value: string): string {
  if (value === "") return "";
  const parsed = new URL(value);
  if (
    parsed.origin !== value ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "Admin API base URL must be an origin without a path, credentials, query, or fragment.",
    );
  }
  return parsed.origin;
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

function createIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `admin_${uuid}` : `admin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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

function fallbackFingerprint(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

async function mutationFingerprint(method: string, url: string, body: unknown): Promise<string> {
  const source = `${method}\n${url}\n${stableValue(body)}`;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(source),
    );
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }
  return fallbackFingerprint(source);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function readCsrfCookie(cookieString?: string): string | undefined {
  const source = cookieString ?? (typeof document !== "undefined" ? document.cookie : "");
  const token = source
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("hv_admin_csrf="))
    ?.slice("hv_admin_csrf=".length);
  if (!token) return undefined;
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

function queryString(query?: AdminListQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export class AdminApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchImplementation;
  private hooks: AdminClientHooks;
  private csrfToken: string | undefined;
  private readonly unresolvedMutationKeys = new Map<string, string>();

  constructor(options?: {
    baseUrl?: string;
    fetchImpl?: FetchImplementation;
    hooks?: AdminClientHooks;
  }) {
    this.baseUrl = normalizeBaseUrl(options?.baseUrl ?? defaultBaseUrl());
    this.fetchImpl = (options?.fetchImpl ?? globalThis.fetch).bind(globalThis);
    this.hooks = options?.hooks ?? {};
  }

  setHooks(hooks: AdminClientHooks): void {
    this.hooks = hooks;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  clearCsrfToken(): void {
    this.csrfToken = undefined;
    this.unresolvedMutationKeys.clear();
  }

  async request<T, TBody = unknown>(
    path: string,
    options: RequestOptions<TBody> = {},
  ): Promise<ApiResult<T>> {
    const method = options.method ?? "GET";
    const isMutation = method !== "GET";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const withPrefix = normalizedPath.startsWith(ADMIN_API_PREFIX)
      ? normalizedPath
      : `${ADMIN_API_PREFIX}${normalizedPath}`;
    const fingerprint = isMutation
      ? await mutationFingerprint(
          method,
          `${this.baseUrl}${withPrefix}${queryString(options.query)}`,
          options.body,
        )
      : undefined;
    const requiresIdempotency = options.requiresIdempotency ?? isMutation;
    const idempotencyKey = requiresIdempotency
      ? (options.idempotencyKey ??
        (fingerprint ? this.unresolvedMutationKeys.get(fingerprint) : undefined) ??
        createIdempotencyKey())
      : options.idempotencyKey;
    if (requiresIdempotency && fingerprint && idempotencyKey && !options.idempotencyKey) {
      this.unresolvedMutationKeys.set(fingerprint, idempotencyKey);
      while (this.unresolvedMutationKeys.size > 128) {
        const oldest = this.unresolvedMutationKeys.keys().next().value;
        if (oldest === undefined) break;
        this.unresolvedMutationKeys.delete(oldest);
      }
    }
    const maxAttempts = isMutation && options.retryNetwork === true && !options.moneyMoving ? 2 : 1;
    let networkAttempt = 0;
    let csrfAttempt = 0;
    let retryableAttempt = 0;

    while (true) {
      const headers = new Headers({ Accept: "application/json" });
      if (options.body !== undefined) headers.set("Content-Type", "application/json");
      if (isMutation && (options.requiresCsrf ?? true)) {
        const csrf = readCsrfCookie() ?? this.csrfToken;
        if (csrf) headers.set("X-CSRF-Token", csrf);
      }
      if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

      let response: Response;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        response = await this.fetchImpl(this.buildUrl(path, options.query), {
          method,
          credentials: "include",
          cache: "no-store",
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });
      } catch (cause) {
        if (isMutation && networkAttempt < maxAttempts - 1) {
          networkAttempt += 1;
          await delay(650);
          continue;
        }
        const timedOut = controller.signal.aborted;
        const code = timedOut ? "TIMEOUT" : "NETWORK_ERROR";
        throw new AdminApiError({
          code,
          status: 0,
          retryable: true,
          idempotencyKey,
          message: safeMessageForCode(code),
          details: cause instanceof Error ? { kind: cause.name } : undefined,
        });
      } finally {
        clearTimeout(timeout);
      }

      const responseCsrfToken = response.headers.get("x-csrf-token");
      if (responseCsrfToken) this.csrfToken = responseCsrfToken;
      const responseRequestId = response.headers.get("x-request-id") ?? undefined;
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      const raw = await response.text();
      const envelope = this.parseJson(raw);

      if (this.isSuccessEnvelope<T>(envelope)) {
        if (fingerprint && this.unresolvedMutationKeys.get(fingerprint) === idempotencyKey) {
          this.unresolvedMutationKeys.delete(fingerprint);
        }
        if (path.endsWith("/auth/logout") || path.endsWith("/auth/sessions/revoke-all"))
          this.clearCsrfToken();
        return { data: envelope.data, request_id: envelope.request_id ?? responseRequestId ?? "" };
      }

      const error = this.toApiError(envelope, response.status, {
        responseRequestId,
        retryAfterMs,
        idempotencyKey,
      });

      if (error.code === "ADMIN_CSRF_TOKEN_INVALID" && csrfAttempt === 0 && isMutation) {
        csrfAttempt += 1;
        await this.refreshCsrfCookie();
        continue;
      }

      if (error.code === "ADMIN_SESSION_EXPIRED") {
        this.clearCsrfToken();
        this.hooks.onSessionExpired?.(error);
      }
      if (error.code === "ADMIN_PERMISSION_DENIED") {
        this.hooks.onPermissionDenied?.(error);
      }

      if (
        isMutation &&
        error.retryable &&
        isRetryableCode(error.code) &&
        retryableAttempt === 0 &&
        error.code === "IDEMPOTENCY_IN_PROGRESS"
      ) {
        retryableAttempt += 1;
        await delay(Math.min(error.retryAfterMs ?? 650, 5000));
        continue;
      }

      if (
        fingerprint &&
        !error.retryable &&
        error.code !== "STEP_UP_REQUIRED" &&
        this.unresolvedMutationKeys.get(fingerprint) === idempotencyKey
      ) {
        this.unresolvedMutationKeys.delete(fingerprint);
      }

      throw error;
    }
  }

  get<T>(path: string, query?: AdminListQuery): Promise<ApiResult<T>> {
    return this.request<T>(path, { method: "GET", query });
  }

  post<T, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "method" | "body">,
  ): Promise<ApiResult<T>> {
    return this.request<T, TBody>(path, { ...options, method: "POST", body });
  }

  patch<T, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "method" | "body">,
  ): Promise<ApiResult<T>> {
    return this.request<T, TBody>(path, { ...options, method: "PATCH", body });
  }

  put<T, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "method" | "body">,
  ): Promise<ApiResult<T>> {
    return this.request<T, TBody>(path, { ...options, method: "PUT", body });
  }

  delete<T, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "method" | "body">,
  ): Promise<ApiResult<T>> {
    return this.request<T, TBody>(path, { ...options, method: "DELETE", body });
  }

  private buildUrl(path: string, query?: AdminListQuery): string {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const withPrefix = normalized.startsWith(ADMIN_API_PREFIX)
      ? normalized
      : `${ADMIN_API_PREFIX}${normalized}`;
    return `${this.baseUrl}${withPrefix}${queryString(query)}`;
  }

  private parseJson(raw: string): unknown {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }

  private isSuccessEnvelope<T>(value: unknown): value is {
    success: true;
    data: T;
    request_id: string;
  } {
    return Boolean(
      value &&
      typeof value === "object" &&
      (value as { success?: unknown }).success === true &&
      "data" in value &&
      typeof (value as { request_id?: unknown }).request_id === "string" &&
      Boolean((value as { request_id?: string }).request_id),
    );
  }

  private toApiError(
    value: unknown,
    status: number,
    options: {
      responseRequestId?: string;
      retryAfterMs?: number;
      idempotencyKey?: string;
    },
  ): AdminApiError {
    if (this.isErrorEnvelope(value)) {
      return errorFromEnvelope(value, status, {
        retryAfterMs: options.retryAfterMs,
        idempotencyKey: options.idempotencyKey,
      });
    }
    const code =
      status === 401
        ? "ADMIN_SESSION_EXPIRED"
        : status === 403
          ? "ADMIN_PERMISSION_DENIED"
          : status === 404
            ? "ROUTE_NOT_FOUND"
            : status === 400 || status === 422
              ? "VALIDATION_FAILED"
              : status === 409
                ? "RESOURCE_CONFLICT"
                : status === 429
                  ? "RATE_LIMITED"
                  : status === 503 || status === 502
                    ? "DEPENDENCY_UNAVAILABLE"
                    : status === 504
                      ? "TIMEOUT"
                      : status >= 500
                        ? "INTERNAL_ERROR"
                        : "MALFORMED_RESPONSE";
    return new AdminApiError({
      code,
      status,
      requestId: options.responseRequestId,
      retryAfterMs: options.retryAfterMs,
      idempotencyKey: options.idempotencyKey,
      retryable: isRetryableCode(code),
    });
  }

  private isErrorEnvelope(value: unknown): value is AdminErrorBody {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<AdminErrorBody>;
    const error = candidate.error;
    return (
      candidate.success === false &&
      Boolean(error && typeof error === "object") &&
      typeof error?.code === "string" &&
      typeof error.message === "string" &&
      typeof error.retryable === "boolean" &&
      typeof error.documentation_url === "string" &&
      typeof candidate.request_id === "string" &&
      candidate.request_id.length > 0
    );
  }

  private async refreshCsrfCookie(): Promise<void> {
    try {
      const response = await this.fetchImpl(this.buildUrl("/auth/me"), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const token = response.headers.get("x-csrf-token");
      if (token) this.csrfToken = token;
    } catch {
      // The original mutation remains the source of truth. Its stable key is retried once.
    }
  }
}

export { createIdempotencyKey, encodeSegment };

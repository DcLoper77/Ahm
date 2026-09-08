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
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function defaultBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_HAVENERR_ADMIN_API_BASE_URL;
  return (configured || "https://api.havenerr.com").replace(/\/$/, "");
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

function createIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `admin_${uuid}` : `admin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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

  constructor(options?: {
    baseUrl?: string;
    fetchImpl?: FetchImplementation;
    hooks?: AdminClientHooks;
  }) {
    this.baseUrl = (options?.baseUrl ?? defaultBaseUrl()).replace(/\/$/, "");
    this.fetchImpl = (options?.fetchImpl ?? globalThis.fetch).bind(globalThis);
    this.hooks = options?.hooks ?? {};
  }

  setHooks(hooks: AdminClientHooks): void {
    this.hooks = hooks;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async request<T, TBody = unknown>(
    path: string,
    options: RequestOptions<TBody> = {},
  ): Promise<ApiResult<T>> {
    const method = options.method ?? "GET";
    const isMutation = method !== "GET";
    const requiresIdempotency = options.requiresIdempotency ?? isMutation;
    const idempotencyKey = requiresIdempotency
      ? (options.idempotencyKey ?? createIdempotencyKey())
      : options.idempotencyKey;
    const maxAttempts = isMutation && (options.retryNetwork ?? true) ? 2 : 1;
    let networkAttempt = 0;
    let csrfAttempt = 0;
    let retryableAttempt = 0;

    while (true) {
      const headers = new Headers({ Accept: "application/json" });
      if (options.body !== undefined) headers.set("Content-Type", "application/json");
      if (isMutation && (options.requiresCsrf ?? true)) {
        const csrf = readCsrfCookie();
        if (csrf) headers.set("X-CSRF-Token", csrf);
      }
      if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

      let response: Response;
      try {
        response = await this.fetchImpl(this.buildUrl(path, options.query), {
          method,
          credentials: "include",
          cache: "no-store",
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
      } catch {
        if (isMutation && networkAttempt < maxAttempts - 1) {
          networkAttempt += 1;
          await delay(650);
          continue;
        }
        throw new AdminApiError({
          code: "TIMEOUT",
          status: 0,
          retryable: true,
          idempotencyKey,
          message: safeMessageForCode("TIMEOUT"),
        });
      }

      const responseRequestId = response.headers.get("x-request-id") ?? undefined;
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      const raw = await response.text();
      const envelope = this.parseJson(raw);

      if (this.isSuccessEnvelope<T>(envelope)) {
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
        error.code !== "ADMIN_LOGIN_THROTTLED"
      ) {
        retryableAttempt += 1;
        await delay(Math.min(error.retryAfterMs ?? 650, 5000));
        continue;
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
          : "INTERNAL_ERROR";
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
    return (
      candidate.success === false &&
      Boolean(candidate.error) &&
      typeof candidate.request_id === "string"
    );
  }

  private async refreshCsrfCookie(): Promise<void> {
    try {
      await this.fetchImpl(this.buildUrl("/auth/me"), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } catch {
      // The original mutation remains the source of truth. Its stable key is retried once.
    }
  }
}

export { createIdempotencyKey, encodeSegment };

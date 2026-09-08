import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiClient, readCsrfCookie } from "./client";
import { AdminApiError } from "./errors";

function success(data: unknown = { ok: true }) {
  return new Response(JSON.stringify({ success: true, data, request_id: "req_test" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function failure(code: string, status = 409) {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code,
        message: "unsafe backend text",
        retryable: code === "IDEMPOTENCY_IN_PROGRESS",
        documentation_url: "https://docs.havenerr.com/errors",
      },
      request_id: "req_error",
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

describe("AdminApiClient", () => {
  beforeEach(() => {
    document.cookie = "hv_admin_csrf=csrf%2Bvalue; path=/";
  });

  it("sends credentialed requests with the readable CSRF cookie and one mutation key", async () => {
    const fetchMock = vi.fn(async () => success());
    const client = new AdminApiClient({
      baseUrl: "https://api.havenerr.com",
      fetchImpl: fetchMock,
    });
    const result = await client.post("/auth/refresh", {});
    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit]>;
    const init = calls[0]?.[1];
    expect(init).toBeDefined();
    if (!init) throw new Error("Expected fetch init");
    const headers = new Headers(init.headers);
    expect(calls[0]?.[0]).toBe("https://api.havenerr.com/admin/v1/auth/refresh");
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    expect(headers.get("X-CSRF-Token")).toBe("csrf+value");
    expect(headers.get("Idempotency-Key")).toMatch(/^admin_/);
    expect(result.request_id).toBe("req_test");
  });

  it("reuses the same idempotency key after a network failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network lost"))
      .mockResolvedValueOnce(success());
    const client = new AdminApiClient({ fetchImpl: fetchMock });
    const request = client.post("/system/jobs/job_123:requeue", {});
    await vi.advanceTimersByTimeAsync(650);
    await request;
    const first = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get(
      "Idempotency-Key",
    );
    const second = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get(
      "Idempotency-Key",
    );
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    vi.useRealTimers();
  });

  it("retries an in-progress idempotent mutation with the same key", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failure("IDEMPOTENCY_IN_PROGRESS"))
      .mockResolvedValueOnce(success({ completed: true }));
    const client = new AdminApiClient({ fetchImpl: fetchMock });
    const request = client.post("/system/jobs/job_123:requeue", {});
    await vi.advanceTimersByTimeAsync(650);
    await expect(request).resolves.toMatchObject({ data: { completed: true } });
    const firstKey = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get(
      "Idempotency-Key",
    );
    const secondKey = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get(
      "Idempotency-Key",
    );
    expect(secondKey).toBe(firstKey);
    vi.useRealTimers();
  });

  it("refreshes CSRF once and retries the same mutation key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failure("ADMIN_CSRF_TOKEN_INVALID", 403))
      .mockResolvedValueOnce(success({ me: true }))
      .mockResolvedValueOnce(success());
    const client = new AdminApiClient({ fetchImpl: fetchMock });
    await client.post("/features/hosting", { enabled: false });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstKey = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get(
      "Idempotency-Key",
    );
    const retryKey = new Headers((fetchMock.mock.calls[2]?.[1] as RequestInit).headers).get(
      "Idempotency-Key",
    );
    expect(firstKey).toBe(retryKey);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("GET");
  });

  it("maps the error catalogue to safe UI text and preserves request ids", async () => {
    const client = new AdminApiClient({
      fetchImpl: vi.fn(async () => failure("ADMIN_SESSION_EXPIRED", 401)),
    });
    await expect(client.get("/auth/me")).rejects.toMatchObject({
      code: "ADMIN_SESSION_EXPIRED",
      requestId: "req_error",
    });
    try {
      await client.get("/auth/me");
    } catch (error) {
      expect(error).toBeInstanceOf(AdminApiError);
      expect((error as AdminApiError).message).not.toContain("unsafe backend text");
    }
  });

  it("requires the exact success envelope, including request_id", async () => {
    const client = new AdminApiClient({
      fetchImpl: vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 }),
      ),
    });
    await expect(client.get("/auth/me")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 200,
    });
  });

  it("notifies session and permission hooks without exposing backend messages", async () => {
    const onSessionExpired = vi.fn();
    const onPermissionDenied = vi.fn();
    const client = new AdminApiClient({
      fetchImpl: vi
        .fn()
        .mockResolvedValueOnce(failure("ADMIN_SESSION_EXPIRED", 401))
        .mockResolvedValueOnce(failure("ADMIN_PERMISSION_DENIED", 403)),
      hooks: { onSessionExpired, onPermissionDenied },
    });
    await expect(client.get("/auth/me")).rejects.toMatchObject({ code: "ADMIN_SESSION_EXPIRED" });
    await expect(client.get("/users")).rejects.toMatchObject({
      code: "ADMIN_PERMISSION_DENIED",
    });
    expect(onSessionExpired).toHaveBeenCalledOnce();
    expect(onPermissionDenied).toHaveBeenCalledOnce();
    expect(onPermissionDenied.mock.calls[0]?.[0]).toBeInstanceOf(AdminApiError);
  });

  it("reads only the browser-readable admin CSRF cookie", () => {
    expect(readCsrfCookie("hv_admin_csrf=abc%2F123; hv_admin_sess=opaque")).toBe("abc/123");
    expect(readCsrfCookie("hv_admin_sess=opaque")).toBeUndefined();
  });
});

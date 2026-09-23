import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiClient, readCsrfCookie } from "./client";
import { AdminApiError } from "./errors";

function success(data: unknown = { ok: true }, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ success: true, data, request_id: "req_test" }), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
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
    { status, headers: { "content-type": "application/json" } },
  );
}

describe("AdminApiClient", () => {
  beforeEach(() => {
    document.cookie = "hv_admin_csrf=csrf%2Bvalue; path=/";
  });

  it("uses the same-origin admin path and sends credentials, CSRF, and idempotency", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => success(),
    );
    const client = new AdminApiClient({ fetchImpl: fetchMock });
    const result = await client.post("/auth/refresh", {});
    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit]>;
    const init = calls[0]?.[1];
    expect(String(calls[0]?.[0])).toBe("/admin/v1/auth/refresh");
    expect(client.getBaseUrl()).toBe("");
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    const headers = new Headers(init.headers);
    expect(headers.get("X-CSRF-Token")).toBe("csrf+value");
    expect(headers.get("Idempotency-Key")).toMatch(/^admin_/);
    expect(result.request_id).toBe("req_test");
  });

  it("can use an explicit API origin in isolated client tests without changing production defaults", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => success(),
    );
    const client = new AdminApiClient({
      baseUrl: "https://api.havenerr.com",
      fetchImpl: fetchMock,
    });
    await client.get("/auth/me");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.havenerr.com/admin/v1/auth/me");
  });

  it("does not automatically resend an uncertain money-moving request and reuses its key on a user retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network lost"))
      .mockResolvedValueOnce(success({ corrected: true }));
    const client = new AdminApiClient({ fetchImpl: fetchMock });
    const body = { correction_class: "DUPLICATE_CAPTURE", reason: "review" };
    let firstKey: string | undefined;
    try {
      await client.post("/billing/payments/pay_1:correct", body, { moneyMoving: true });
    } catch (error) {
      expect(error).toMatchObject({
        code: "NETWORK_ERROR",
        status: 0,
        idempotencyKey: expect.stringMatching(/^admin_/),
      });
      firstKey = (error as AdminApiError).idempotencyKey;
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(
      client.post("/billing/payments/pay_1:correct", body, { moneyMoving: true }),
    ).resolves.toMatchObject({ data: { corrected: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit]>;
    const retryKey = new Headers(calls[1]?.[1].headers).get("Idempotency-Key");
    expect(retryKey).toBe(firstKey);
  });

  it("retries only the stable in-progress idempotency conflict with the same key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failure("IDEMPOTENCY_IN_PROGRESS"))
      .mockResolvedValueOnce(success({ completed: true }));
    const client = new AdminApiClient({ fetchImpl: fetchMock });
    const request = client.post("/system/jobs/job_123:requeue", {});
    await expect(request).resolves.toMatchObject({ data: { completed: true } });
    const firstKey = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get(
      "Idempotency-Key",
    );
    const secondKey = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get(
      "Idempotency-Key",
    );
    expect(secondKey).toBe(firstKey);
  });

  it("refreshes CSRF once and retries the same mutation key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failure("ADMIN_CSRF_TOKEN_INVALID", 403))
      .mockResolvedValueOnce(success({ me: true }))
      .mockResolvedValueOnce(success());
    const client = new AdminApiClient({ fetchImpl: fetchMock });
    await client.post("/features/email_password", { enabled: false });
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

  it("keeps the response CSRF header in memory when the cookie is not readable", async () => {
    document.cookie = "hv_admin_csrf=; path=/; max-age=0";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(success({ id: "adm_1" }, { "x-csrf-token": "session-csrf" }))
      .mockResolvedValueOnce(success());
    const client = new AdminApiClient({ fetchImpl: fetchMock });
    await client.get("/auth/me");
    await client.post("/auth/refresh", {});
    expect(
      new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get("X-CSRF-Token"),
    ).toBe("session-csrf");
  });

  it("distinguishes route 404s from missing records and preserves request IDs", async () => {
    const client = new AdminApiClient({
      fetchImpl: vi.fn(async () => failure("ROUTE_NOT_FOUND", 404)),
    });
    await expect(client.get("/missing")).rejects.toMatchObject({
      code: "ROUTE_NOT_FOUND",
      requestId: "req_error",
    });
    try {
      await client.get("/missing");
    } catch (error) {
      expect(error).toBeInstanceOf(AdminApiError);
      expect((error as AdminApiError).message).not.toContain("unsafe backend text");
    }
  });

  it("maps an unwrapped 404 to a route error instead of an internal or empty state", async () => {
    const client = new AdminApiClient({
      fetchImpl: vi.fn(async () => new Response("not found", { status: 404 })),
    });
    await expect(client.get("/stale-path")).rejects.toMatchObject({
      code: "ROUTE_NOT_FOUND",
      status: 404,
    });
  });

  it("requires the exact success envelope, including request_id", async () => {
    const client = new AdminApiClient({
      fetchImpl: vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 }),
      ),
    });
    await expect(client.get("/auth/me")).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
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
    await expect(client.get("/users")).rejects.toMatchObject({ code: "ADMIN_PERMISSION_DENIED" });
    expect(onSessionExpired).toHaveBeenCalledOnce();
    expect(onPermissionDenied).toHaveBeenCalledOnce();
    expect(onPermissionDenied.mock.calls[0]?.[0]).toBeInstanceOf(AdminApiError);
  });

  it("reads only the browser-readable admin CSRF cookie", () => {
    expect(readCsrfCookie("hv_admin_csrf=abc%2F123; hv_admin_sess=opaque")).toBe("abc/123");
    expect(readCsrfCookie("hv_admin_sess=opaque")).toBeUndefined();
  });
});

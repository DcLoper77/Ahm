import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiClient } from "./client";
import { createAdminApi } from "./api";

function success(data: unknown = {}) {
  return new Response(JSON.stringify({ success: true, data, request_id: "req_api_test" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("documented admin route construction", () => {
  beforeEach(() => {
    document.cookie = "hv_admin_csrf=csrf-test; path=/";
  });

  it("keeps each list family on its documented filter and cursor keys", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return success();
    });
    const api = createAdminApi(
      new AdminApiClient({ baseUrl: "https://api.havenerr.com", fetchImpl: fetchMock }),
    );

    await api.users.list({
      cursor: "cursor-users",
      limit: 25,
      status: "ACTIVE",
      sort_by: "email",
      sort_order: "desc",
      state: "must-not-leak",
    });
    await api.hosting.projects({
      cursor: "cursor-hosting",
      limit: 25,
      desired_state: "RUNNING",
      sync_state: "IN_SYNC",
      state: "must-not-leak",
    });
    await api.domains.list({
      service_id: "svc_1",
      ownership_state: "VERIFIED",
      certificate_state: "ACTIVE",
      unsupported: "must-not-leak",
    });
    await api.databases.list({ project_id: "prj_1", kind: "sql", state: "ACTIVE" });
    await api.vps.list({ sku: "standard", bundled: true, state: "RUNNING" });
    await api.billing.payments({ invoice_id: "inv_1", status: "FAILED", sort_by: "status" });
    await api.audit.list({ target_id: "usr_1", outcome: "FAILED", from: "2026-01-01T00:00:00Z" });
    await api.system.jobs({ state: "DEAD", type: "hosting", unsupported: "must-not-leak" });

    const urls = calls.map(([input]) => String(input));
    expect(urls[0]).toBe(
      "https://api.havenerr.com/admin/v1/users?cursor=cursor-users&limit=25&status=ACTIVE&sort_by=email&sort_order=desc",
    );
    expect(urls[1]).toBe(
      "https://api.havenerr.com/admin/v1/hosting/projects?cursor=cursor-hosting&limit=25&desired_state=RUNNING&sync_state=IN_SYNC",
    );
    expect(urls[2]).toBe(
      "https://api.havenerr.com/admin/v1/domains?service_id=svc_1&ownership_state=VERIFIED&certificate_state=ACTIVE",
    );
    expect(urls[3]).toContain("/admin/v1/databases?project_id=prj_1&kind=sql&state=ACTIVE");
    expect(urls[4]).toContain(
      "/admin/v1/infrastructure/vps?state=RUNNING&sku=standard&bundled=true",
    );
    expect(urls[5]).toContain(
      "/admin/v1/billing/payments?invoice_id=inv_1&status=FAILED&sort_by=status",
    );
    expect(urls[6]).toContain(
      "/admin/v1/audit?target_id=usr_1&outcome=FAILED&from=2026-01-01T00%3A00%3A00Z",
    );
    expect(urls[7]).toBe("https://api.havenerr.com/admin/v1/system/jobs?state=DEAD&type=hosting");
    expect(urls.join("\n")).not.toContain("must-not-leak");
  });

  it("preserves encoded action segments and stable mutation keys", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return success({ queued: true });
    });
    const api = createAdminApi(
      new AdminApiClient({ baseUrl: "https://api.havenerr.com", fetchImpl: fetchMock }),
    );

    await api.users.action(
      "usr/one",
      "suspend",
      { reason: "Support review", expected_version: 4 },
      "stable-key",
    );
    await api.catalogue.diff("plans", 7);
    await api.quotas.clear("org_1", "storage_bytes", 3, "quota-key");
    await api.system.quarantineAction(
      "qtn/1",
      "reject",
      { note: "Evidence reviewed" },
      "quarantine-key",
    );

    expect(String(calls[0]?.[0])).toBe("https://api.havenerr.com/admin/v1/users/usr%2Fone:suspend");
    expect(String(calls[1]?.[0])).toBe("https://api.havenerr.com/admin/v1/plans/versions/7:diff");
    expect(String(calls[2]?.[0])).toBe(
      "https://api.havenerr.com/admin/v1/quotas/org_1/storage_bytes:clear",
    );
    expect(String(calls[3]?.[0])).toBe(
      "https://api.havenerr.com/admin/v1/system/quarantine/qtn%2F1:reject",
    );
    expect(new Headers(calls[0]?.[1]?.headers).get("Idempotency-Key")).toBe("stable-key");
    expect(new Headers(calls[2]?.[1]?.headers).get("Idempotency-Key")).toBe("quota-key");
    expect(new Headers(calls[3]?.[1]?.headers).get("Idempotency-Key")).toBe("quarantine-key");
  });
});

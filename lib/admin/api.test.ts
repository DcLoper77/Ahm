import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiClient } from "./client";
import { createAdminApi } from "./api";

function success(data: unknown = {}) {
  return new Response(JSON.stringify({ success: true, data, request_id: "req_api_test" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function createApi() {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push([input, init]);
    return success();
  });
  return {
    calls,
    fetchMock,
    api: createAdminApi(
      new AdminApiClient({ baseUrl: "https://api.havenerr.com", fetchImpl: fetchMock }),
    ),
  };
}

describe("supported Admin plane route construction", () => {
  beforeEach(() => {
    document.cookie = "hv_admin_csrf=csrf-test; path=/";
  });

  it("sends only backend-supported list filters and preserves signed cursors", async () => {
    const { api, calls } = createApi();
    await api.users.list({
      cursor: "user-cursor",
      limit: 25,
      status: "ACTIVE",
      email: "a@example.com",
      sort_by: "email",
      sort_order: "desc",
      unsupported: "drop",
    });
    await api.organizations.list({
      cursor: "org-cursor",
      limit: 50,
      state: "ACTIVE",
      plan_code: "developer",
      kind: "TEAM",
      owner_user_id: "usr_1",
      sort_by: "slug",
      sort_order: "asc",
      unsupported: "drop",
    });
    await api.databases.list({
      cursor: "db-cursor",
      limit: 10,
      org_id: "org_1",
      project_id: "prj_1",
      kind: "sql",
      state: "ACTIVE",
      sort_by: "updated_at",
      sort_order: "desc",
      unsupported: "drop",
    });
    await api.quickDatabases.list({
      cursor: "quick-cursor",
      limit: 10,
      org_id: "org_1",
      kind: "redis",
      state: "READY",
      sort_order: "desc",
      sort_by: "unsupported",
    });
    await api.billing.subscriptions({
      cursor: "sub-cursor",
      limit: 20,
      org_id: "org_1",
      status: "ACTIVE",
      plan_code: "founder",
      currency: "inr",
      sort_by: "current_period_end",
      sort_order: "desc",
    });
    await api.billing.invoices({
      cursor: "invoice-cursor",
      limit: 25,
      org_id: "org_1",
      status: "OPEN",
      currency: "usd",
      sort_by: "issued_at",
      sort_order: "asc",
    });
    await api.billing.payments({
      cursor: "payment-cursor",
      limit: 25,
      org_id: "org_1",
      invoice_id: "inv_1",
      status: "FAILED",
      sort_by: "status",
      sort_order: "desc",
      currency: "must-drop",
    });
    await api.billing.refunds({
      cursor: "refund-cursor",
      limit: 25,
      org_id: "org_1",
      payment_id: "pay_1",
      status: "REFUNDED",
      sort_by: "status",
      sort_order: "desc",
      currency: "must-drop",
    });
    await api.feedback.list({
      cursor: "feedback-cursor",
      limit: 25,
      stars: 5,
      user_id: "usr_1",
      from: "2026-01-01T00:00:00Z",
      to: "2026-02-01T00:00:00Z",
      sort_by: "stars",
      sort_order: "asc",
      org_id: "must-drop",
    });
    await api.audit.list({
      cursor: "audit-cursor",
      limit: 25,
      sort_by: "seq",
      sort_order: "desc",
      actor_id: "adm_1",
      action: "admin.test",
      target_type: "org",
      target_id: "org_1",
      outcome: "SUCCESS",
      org_id: "org_1",
      from: "2026-01-01T00:00:00Z",
      to: "2026-02-01T00:00:00Z",
      unsupported: "drop",
    });
    await api.system.jobs({
      cursor: "jobs-cursor",
      limit: 10,
      state: "FAILED",
      type: "admin.reconcile.billing",
      unsupported: "drop",
    });
    await api.system.outbox({
      cursor: "outbox-cursor",
      limit: 10,
      state: "FAILED",
      intent: "admin.database.access",
      unsupported: "drop",
    });
    await api.system.quarantine({
      cursor: "quarantine-cursor",
      limit: 10,
      system: "billing",
      state: "OPEN",
      drift_class: "invoice_gap",
      sort_order: "desc",
      unsupported: "drop",
    });

    const urls = calls.map(([input]) => String(input));
    expect(urls[0]).toBe(
      "https://api.havenerr.com/admin/v1/users?cursor=user-cursor&limit=25&status=ACTIVE&email=a%40example.com&sort_by=email&sort_order=desc",
    );
    expect(urls[1]).toBe(
      "https://api.havenerr.com/admin/v1/orgs?cursor=org-cursor&limit=50&state=ACTIVE&plan_code=developer&kind=TEAM&owner_user_id=usr_1&sort_by=slug&sort_order=asc",
    );
    expect(urls[2]).toBe(
      "https://api.havenerr.com/admin/v1/databases?cursor=db-cursor&limit=10&sort_order=desc&org_id=org_1&project_id=prj_1&kind=sql&state=ACTIVE&sort_by=updated_at",
    );
    expect(urls[3]).toBe(
      "https://api.havenerr.com/admin/v1/quick-databases?cursor=quick-cursor&limit=10&sort_order=desc&org_id=org_1&kind=redis&state=READY",
    );
    expect(urls[4]).toBe(
      "https://api.havenerr.com/admin/v1/billing/subscriptions?cursor=sub-cursor&limit=20&sort_order=desc&org_id=org_1&status=ACTIVE&plan_code=founder&currency=inr&sort_by=current_period_end",
    );
    expect(urls[5]).toBe(
      "https://api.havenerr.com/admin/v1/billing/invoices?cursor=invoice-cursor&limit=25&sort_order=asc&org_id=org_1&status=OPEN&currency=usd&sort_by=issued_at",
    );
    expect(urls[6]).toBe(
      "https://api.havenerr.com/admin/v1/billing/payments?cursor=payment-cursor&limit=25&sort_order=desc&org_id=org_1&invoice_id=inv_1&status=FAILED&sort_by=status",
    );
    expect(urls[7]).toBe(
      "https://api.havenerr.com/admin/v1/billing/refunds?cursor=refund-cursor&limit=25&sort_order=desc&org_id=org_1&payment_id=pay_1&status=REFUNDED&sort_by=status",
    );
    expect(urls[8]).toBe(
      "https://api.havenerr.com/admin/v1/feedback?cursor=feedback-cursor&limit=25&stars=5&user_id=usr_1&from=2026-01-01T00%3A00%3A00Z&to=2026-02-01T00%3A00%3A00Z&sort_by=stars&sort_order=asc",
    );
    expect(urls[9]).toBe(
      "https://api.havenerr.com/admin/v1/audit?cursor=audit-cursor&limit=25&sort_by=seq&sort_order=desc&actor_id=adm_1&action=admin.test&target_type=org&target_id=org_1&outcome=SUCCESS&org_id=org_1&from=2026-01-01T00%3A00%3A00Z&to=2026-02-01T00%3A00%3A00Z",
    );
    expect(urls[10]).toBe(
      "https://api.havenerr.com/admin/v1/system/jobs?cursor=jobs-cursor&limit=10&state=FAILED&type=admin.reconcile.billing",
    );
    expect(urls[11]).toBe(
      "https://api.havenerr.com/admin/v1/system/outbox?cursor=outbox-cursor&limit=10&state=FAILED&intent=admin.database.access",
    );
    expect(urls[12]).toBe(
      "https://api.havenerr.com/admin/v1/system/quarantine?cursor=quarantine-cursor&limit=10&system=billing&state=OPEN&drift_class=invoice_gap&sort_order=desc",
    );
    expect(urls.join("\n")).not.toContain("must-drop");
    expect(urls.join("\n")).not.toContain("unsupported");
  });

  it("uses immutable plan revision IDs, typed tier assignment routes, and the payment correction action", async () => {
    const { api, calls } = createApi();
    const definition = { plans: [], addons: [] };
    await api.catalogue.revisions();
    await api.catalogue.createDraft(definition, "catalogue-key");
    await api.catalogue.revision("pcv_01H00000000000000000000000");
    await api.catalogue.diff("pcv_01H00000000000000000000000");
    await api.catalogue.action(
      "pcv_01H00000000000000000000000",
      "publish",
      { expected_version: 3 },
      "publish-key",
    );
    await api.tiers.list();
    await api.tiers.detail("cti_01H00000000000000000000000");
    await api.tiers.create(
      {
        key: "priority_support",
        name: "Priority support",
        billing_mode: "FREE",
        interval: "GRANT",
        default_duration_days: 30,
        limits: {},
        features: [],
      },
      "tier-create-key",
    );
    await api.tiers.patch(
      "cti_01H00000000000000000000000",
      {
        name: "Priority support",
        billing_mode: "FREE",
        interval: "GRANT",
        default_duration_days: 60,
        limits: {},
        features: [],
        expected_version: 2,
      },
      "tier-edit-key",
    );
    await api.tiers.action(
      "cti_01H00000000000000000000000",
      "validate",
      { expected_version: 1 },
      "tier-validate-key",
    );
    await api.users.tierAssignments("usr_1");
    await api.users.assignTier(
      "usr_1",
      {
        org_id: "org_1",
        tier_id: "cti_1",
        revision_id: "ctr_1",
        duration_days: 30,
        expected_version: 0,
        replace_active: false,
        reason: "Approved support grant",
      },
      "tier-assign-key",
    );
    await api.users.revokeTierAssignment(
      "usr_1",
      "cta_1",
      { reason: "Grant ended", expected_version: 1 },
      "tier-revoke-key",
    );
    await api.billing.correctPayment(
      "pay_1",
      { correction_class: "DUPLICATE_CAPTURE", reason: "Duplicate charge" },
      "correction-key",
    );
    await api.billing.cancelSubscription(
      "sub_1",
      { expected_version: 3, reason: "Customer requested cancellation" },
      "cancel-key",
    );
    await api.system.runReconciler("quick_databases", "reconcile-key");

    const urls = calls.map(([input]) => String(input));
    expect(urls[0]).toBe("https://api.havenerr.com/admin/v1/plans");
    expect(urls[1]).toBe("https://api.havenerr.com/admin/v1/plans/versions");
    expect(urls[2]).toBe(
      "https://api.havenerr.com/admin/v1/plans/versions/pcv_01H00000000000000000000000",
    );
    expect(urls[3]).toBe(
      "https://api.havenerr.com/admin/v1/plans/versions/pcv_01H00000000000000000000000:diff",
    );
    expect(urls[4]).toBe(
      "https://api.havenerr.com/admin/v1/plans/versions/pcv_01H00000000000000000000000:publish",
    );
    expect(urls[10]).toBe("https://api.havenerr.com/admin/v1/users/usr_1/tier-assignments");
    expect(urls[11]).toBe("https://api.havenerr.com/admin/v1/users/usr_1/tier-assignments");
    expect(urls[12]).toBe(
      "https://api.havenerr.com/admin/v1/users/usr_1/tier-assignments/cta_1:revoke",
    );
    expect(urls[13]).toBe("https://api.havenerr.com/admin/v1/billing/payments/pay_1:correct");
    expect(urls[14]).toBe("https://api.havenerr.com/admin/v1/billing/subscriptions/sub_1:cancel");
    expect(urls[15]).toBe(
      "https://api.havenerr.com/admin/v1/system/reconcilers/quick_databases:run",
    );
    expect(urls.some((url) => url.includes(":refund"))).toBe(false);

    const publishInit = calls[4]?.[1] as RequestInit;
    const correctionInit = calls[13]?.[1] as RequestInit;
    const cancelInit = calls[14]?.[1] as RequestInit;
    const reconcileInit = calls[15]?.[1] as RequestInit;
    expect(publishInit.method).toBe("POST");
    expect(JSON.parse(String(publishInit.body))).toEqual({ expected_version: 3 });
    expect(new Headers(publishInit.headers).get("Idempotency-Key")).toBe("publish-key");
    expect(new Headers(publishInit.headers).get("X-CSRF-Token")).toBe("csrf-test");
    expect(JSON.parse(String(correctionInit.body))).toEqual({
      correction_class: "DUPLICATE_CAPTURE",
      reason: "Duplicate charge",
    });
    expect(new Headers(correctionInit.headers).get("Idempotency-Key")).toBe("correction-key");
    expect(new Headers(correctionInit.headers).get("X-CSRF-Token")).toBe("csrf-test");
    expect(JSON.parse(String(cancelInit.body))).toEqual({
      expected_version: 3,
      reason: "Customer requested cancellation",
    });
    expect(JSON.parse(String(cancelInit.body))).not.toHaveProperty("immediate");
    expect(JSON.parse(String(reconcileInit.body))).toEqual({});
    expect(new Headers(reconcileInit.headers).get("Idempotency-Key")).toBe("reconcile-key");
  });

  it("keeps authentication setup on the dedicated auth routes and excludes removed product surfaces", async () => {
    const { api, calls } = createApi();
    await api.login({ email: "operator@example.com", password: "fixture-password" });
    await api.me();
    await api.refresh();
    await api.logout();
    await api.sessions();
    await api.revokeSession("ase_1", "revoke-key");
    await api.revokeAll("revoke-all-key");
    await api.enrollMfa("enroll-key");
    await api.confirmMfa("123456", "confirm-key");
    await api.rotateRecoveryCodes("123456", "rotate-key");
    await api.rotatePassword(
      { current_password: "old-password", new_password: "a-very-long-new-password" },
      "password-key",
    );
    await api.acceptInvitation(
      "invite/secret",
      { password: "a-very-long-new-password" },
      "accept-key",
    );

    expect(String(calls[0]?.[0])).toBe("https://api.havenerr.com/admin/v1/auth/login");
    const loginHeaders = new Headers(calls[0]?.[1]?.headers);
    expect(loginHeaders.has("X-CSRF-Token")).toBe(false);
    expect(loginHeaders.has("Idempotency-Key")).toBe(false);
    expect(String(calls[1]?.[0])).toBe("https://api.havenerr.com/admin/v1/auth/me");
    expect(String(calls[2]?.[0])).toBe("https://api.havenerr.com/admin/v1/auth/refresh");
    expect(String(calls[3]?.[0])).toBe("https://api.havenerr.com/admin/v1/auth/logout");
    const mutationHeaders = new Headers(calls[2]?.[1]?.headers);
    expect(mutationHeaders.get("X-CSRF-Token")).toBe("csrf-test");
    expect(mutationHeaders.get("Idempotency-Key")).toMatch(/^admin_/);
    expect(String(calls[11]?.[0])).toBe(
      "https://api.havenerr.com/admin/v1/invitations/invite%2Fsecret:accept",
    );
    expect(api).not.toHaveProperty("hosting");
    expect(api).not.toHaveProperty("domains");
    expect(api).not.toHaveProperty("vps");
    expect(calls.map(([input]) => String(input)).join("\n")).not.toMatch(
      /\/admin\/v1\/(hosting|domains|deployments|infrastructure\/vps|system\/workers)(\/|\?|$)/,
    );
  });
});

import { expect, test, type Page } from "@playwright/test";

type Role = "ROOT" | "ANALYST";

function envelope(data: unknown) {
  return { success: true, data, request_id: "req_e2e" };
}

function errorEnvelope(code: string, retryable = false, details?: unknown) {
  return {
    success: false,
    error: {
      code,
      message: "test response",
      ...(details === undefined ? {} : { details }),
      retryable,
      documentation_url: "https://docs.havenerr.com/errors",
    },
    request_id: "req_e2e_error",
  };
}

async function mockAdminApi(
  page: Page,
  role: Role = "ROOT",
  options: { stepUp?: boolean; longFeedback?: boolean; paymentCorrectionUncertain?: boolean } = {},
) {
  const state = {
    authenticated: false,
    csrfFailureUsed: false,
    stepUpFailureUsed: false,
    expireUsers: false,
    mutationHeaders: [] as Record<string, string>[],
    feedbackRequests: [] as string[],
    correctionFailureUsed: false,
    paymentCorrectionRequests: [] as {
      path: string;
      body: Record<string, unknown>;
      headers: Record<string, string>;
    }[],
    tierAssignments: [] as Record<string, unknown>[],
    tierAssignmentRequests: [] as {
      body: Record<string, unknown>;
      headers: Record<string, string>;
    }[],
    deploymentRequests: [] as {
      path: string;
      body: Record<string, unknown>;
      headers: Record<string, string>;
    }[],
    configRequests: [] as {
      path: string;
      method: string;
      body: Record<string, unknown>;
      headers: Record<string, string>;
    }[],
    secretRequests: [] as {
      path: string;
      method: string;
      body: Record<string, unknown>;
      headers: Record<string, string>;
    }[],
    restartRequests: [] as { body: Record<string, unknown>; headers: Record<string, string> }[],
    deploymentOperation: null as Record<string, unknown> | null,
    restartOperation: null as Record<string, unknown> | null,
    configValue: "info",
    savedConfigRevision: "c".repeat(64),
    runtimeFlaps: 0,
    logRequests: [] as number[],
  };
  const feedbackMessage = options.longFeedback
    ? `<script>not executable</script>${"x".repeat(1940)}`
    : "The main website is clear and easy to use.";
  const previousDeployment = {
    id: "dpl_previous_e2e",
    release_id: "dpl_previous_e2e",
    kind: "DEPLOY",
    state: "SUCCEEDED",
    current_step: "SUCCEEDED",
    candidate_sha: "a".repeat(40),
    previous_commit: "9".repeat(40),
    resulting_active_revision: "a".repeat(40),
    requested_at: "2026-09-23T10:00:00.000Z",
    requested_by: "adm_e2e",
    reason: "Previously verified production release",
    safe_error: null,
    rollback_state: null,
    steps: { SUCCEEDED: "2026-09-23T10:03:00.000Z" },
  };
  await page
    .context()
    .addCookies([{ name: "hv_admin_csrf", value: "browser-csrf", domain: "localhost", path: "/" }]);
  await page.route(/\/admin\/v1\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const headers = request.headers();
    const cors = {
      "access-control-allow-origin": "http://localhost:3000",
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "Content-Type, X-CSRF-Token, Idempotency-Key",
      vary: "Origin",
    };
    const fulfill = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: cors,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (path.endsWith("/auth/me") && method === "GET") {
      if (!state.authenticated) return fulfill(401, errorEnvelope("ADMIN_SESSION_EXPIRED"));
      return fulfill(
        200,
        envelope({
          id: "adm_e2e",
          email: "operator@example.com",
          roles: [role],
          permissions:
            role === "ROOT"
              ? ["*"]
              : ["analytics.read", "audit.read", "catalog.read", "tiers.read"],
          assignable_roles:
            role === "ROOT"
              ? [
                  "ROOT",
                  "PLATFORM_ADMIN",
                  "SUPPORT_OPERATOR",
                  "BILLING_ADMIN",
                  "INFRA_ADMIN",
                  "ANALYST",
                ]
              : [],
          mfa_enabled: true,
          mfa_satisfied: true,
          session_id: "ase_e2e",
        }),
      );
    }
    if (path.endsWith("/auth/login") && method === "POST") {
      state.authenticated = true;
      return fulfill(
        200,
        envelope({
          admin_user_id: "adm_e2e",
          roles: [role],
          mfa_enrollment_required: false,
          idle_expires_at: "2026-09-08T20:00:00.000Z",
          absolute_expires_at: "2026-09-09T12:00:00.000Z",
        }),
      );
    }
    if (!state.authenticated) return fulfill(401, errorEnvelope("ADMIN_SESSION_EXPIRED"));
    if (method !== "GET") state.mutationHeaders.push(headers);
    const activeRelease = {
      release_id: "dpl_current_e2e",
      commit_sha: "a".repeat(40),
      built_at: "2026-09-24T10:00:00.000Z",
      branch: "main",
    };
    if (path === "/admin/v1/deploy/status" && method === "GET") {
      return fulfill(
        200,
        envelope({
          active: activeRelease,
          pm2: { status: "online", pid: 5000, uptime_ms: 120000 },
          readiness: "ready",
          serving_commit: activeRelease.commit_sha,
          revision_matches_active: true,
          active_operation: state.deploymentOperation,
        }),
      );
    }
    if (path === "/admin/v1/deploy/remote" && method === "GET") {
      return fulfill(
        200,
        envelope({
          current: activeRelease,
          candidate_sha: "b".repeat(40),
          candidate_title: "Add operator control improvements",
          branch: "main",
          ahead: 1,
          diverged: false,
          commits: [
            {
              sha: "b".repeat(40),
              title: "Add operator control improvements",
              author: "Fixture operator",
              committed_at: "2026-09-24T11:00:00.000Z",
            },
          ],
          checked_at: "2026-09-24T11:00:00.000Z",
        }),
      );
    }
    if (path === "/admin/v1/deploy/history" && method === "GET") {
      return fulfill(
        200,
        envelope({
          deployments: [
            state.deploymentOperation,
            state.restartOperation,
            previousDeployment,
          ].filter(Boolean),
        }),
      );
    }
    const logMatch = path.match(/^\/admin\/v1\/deploy\/history\/([^/]+)\/logs$/);
    if (logMatch && method === "GET") {
      const offset = Number(url.searchParams.get("after") ?? "0");
      state.logRequests.push(offset);
      return fulfill(
        200,
        envelope({
          lines:
            offset === 0
              ? [
                  {
                    at: "2026-09-24T11:00:00.000Z",
                    phase: "BUILDING",
                    stream: "stdout",
                    text: "Candidate build passed.",
                  },
                ]
              : [],
          next_offset: 100,
        }),
      );
    }
    const detailMatch = path.match(/^\/admin\/v1\/deploy\/history\/([^/]+)$/);
    if (detailMatch && method === "GET") {
      const operation = [
        state.deploymentOperation,
        state.restartOperation,
        previousDeployment,
      ].find((item) => item?.id === detailMatch[1]);
      return operation
        ? fulfill(200, envelope(operation))
        : fulfill(404, errorEnvelope("DEPLOYMENT_NOT_FOUND"));
    }
    if (path === "/admin/v1/deployments" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      state.deploymentRequests.push({ path, body, headers });
      state.deploymentOperation = {
        id: "dpl_deploy_e2e",
        kind: "DEPLOY",
        state: "BUILDING",
        current_step: "BUILDING",
        candidate_sha: body.candidate_sha,
        candidate_short_sha: String(body.candidate_sha).slice(0, 12),
        previous_commit: activeRelease.commit_sha,
        resulting_active_revision: null,
        requested_at: "2026-09-24T11:00:00.000Z",
        started_at: "2026-09-24T11:00:01.000Z",
        requested_by: "adm_e2e",
        reason: body.reason,
        failure_stage: null,
        safe_error: null,
        rollback_state: null,
        steps: {
          FETCHING: "2026-09-24T11:00:01.000Z",
          PREPARING: "2026-09-24T11:00:02.000Z",
          BUILDING: "2026-09-24T11:00:03.000Z",
        },
      };
      return fulfill(202, envelope({ operation_id: "dpl_deploy_e2e", state: "QUEUED" }));
    }
    if (path.startsWith("/admin/v1/deployments/") && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      state.deploymentRequests.push({ path, body, headers });
      if (path.endsWith(":rollback")) {
        state.deploymentOperation = {
          id: "dpl_rollback_e2e",
          kind: "ROLLBACK",
          state: "QUEUED",
          current_step: "QUEUED",
          candidate_sha: "a".repeat(40),
          previous_commit: "b".repeat(40),
          resulting_active_revision: null,
          requested_at: "2026-09-24T11:01:00.000Z",
          requested_by: "adm_e2e",
          reason: body.reason,
          safe_error: null,
          rollback_state: null,
          steps: {},
        };
        return fulfill(202, envelope({ operation_id: "dpl_rollback_e2e", state: "QUEUED" }));
      }
      return fulfill(
        200,
        envelope({ operation_id: "dpl_deploy_e2e", cancellation_requested: true }),
      );
    }
    if (path === "/admin/v1/system/runtime" && method === "GET") {
      if (state.runtimeFlaps > 0) {
        state.runtimeFlaps -= 1;
        return fulfill(503, errorEnvelope("DEPENDENCY_UNAVAILABLE", true));
      }
      if (state.restartOperation) {
        state.restartOperation.state = "SUCCEEDED";
        state.restartOperation.current_step = "SUCCEEDED";
        state.restartOperation.resulting_active_revision = activeRelease.commit_sha;
        state.restartOperation.finished_at = "2026-09-24T11:02:00.000Z";
      }
      return fulfill(
        200,
        envelope({
          active: activeRelease,
          pm2: { status: "online", pid: 5000, uptime_ms: 1000 },
          readiness: "ready",
          serving_commit: activeRelease.commit_sha,
          revision_matches_active: true,
          active_operation: null,
        }),
      );
    }
    if (path === "/admin/v1/system/runtime:restart" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      state.restartRequests.push({ body, headers });
      state.runtimeFlaps = 2;
      state.restartOperation = {
        id: "dpl_restart_e2e",
        kind: "RESTART",
        state: "RESTARTING",
        current_step: "RESTARTING",
        previous_commit: activeRelease.commit_sha,
        resulting_active_revision: null,
        requested_at: "2026-09-24T11:01:00.000Z",
        requested_by: "adm_e2e",
        reason: body.reason,
        safe_error: null,
        rollback_state: null,
        steps: { RESTARTING: "2026-09-24T11:01:00.000Z" },
      };
      return fulfill(202, envelope({ operation_id: "dpl_restart_e2e", state: "QUEUED" }));
    }
    if (path === "/admin/v1/system/config" && method === "GET") {
      return fulfill(
        200,
        envelope({
          entries: [
            { key: "LOG_LEVEL", value: state.configValue, editable: true, masked: false },
            { key: "DUNESBIT_PROJECT_API_KEY", value: null, editable: false, masked: true },
          ],
          editable_keys: ["LOG_LEVEL", "HOST"],
          saved_revision: state.savedConfigRevision,
          running_revision: "c".repeat(64),
          restart_required: state.savedConfigRevision !== "c".repeat(64),
        }),
      );
    }
    if (path === "/admin/v1/system/config/validate" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      state.configRequests.push({ path, method, body, headers });
      return fulfill(200, envelope({ valid: true, issues: [] }));
    }
    if (path === "/admin/v1/system/config" && method === "PUT") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      state.configRequests.push({ path, method, body, headers });
      const changes = body.changes as Array<{ key: string; value: string | null }>;
      state.configValue =
        changes.find((change) => change.key === "LOG_LEVEL")?.value ?? state.configValue;
      state.savedConfigRevision = "d".repeat(64);
      return fulfill(
        200,
        envelope({
          saved_revision: state.savedConfigRevision,
          running_revision: "c".repeat(64),
          restart_required: true,
        }),
      );
    }
    if (path === "/admin/v1/system/config/revert" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      state.configRequests.push({ path, method, body, headers });
      state.configValue = "info";
      state.savedConfigRevision = "e".repeat(64);
      return fulfill(
        200,
        envelope({
          saved_revision: state.savedConfigRevision,
          running_revision: "c".repeat(64),
          restart_required: true,
        }),
      );
    }
    if (path === "/admin/v1/system/secrets" && method === "GET") {
      return fulfill(
        200,
        envelope({
          secrets: [
            { name: "database-password", updated_at: "2026-09-24T10:00:00.000Z", size_bytes: 32 },
          ],
        }),
      );
    }
    if (path.startsWith("/admin/v1/system/secrets") && method !== "GET") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      state.secretRequests.push({ path, method, body, headers });
      if (path.endsWith(":reveal"))
        return fulfill(200, envelope({ name: "database-password", value: "secret-reveal-e2e" }));
      return fulfill(200, envelope({ name: "database-password", restart_required: true }));
    }
    if (path.endsWith("/usage"))
      return fulfill(
        200,
        envelope({ total_users: 128, total_orgs: 42, active_services: 31, failed_resources: 2 }),
      );
    if (path.endsWith("/system/health"))
      return fulfill(
        200,
        envelope({
          status: "READY",
          dependencies: "healthy",
          databases: "healthy",
          quick_databases: "healthy",
          queue: "healthy",
          audit_chain: "healthy",
        }),
      );
    if (path.endsWith("/audit")) return fulfill(200, envelope({ audit: [], next_cursor: null }));
    if (path.match(/\/feedback\/fbk_/))
      return fulfill(
        200,
        envelope({
          feedback: {
            id: "fbk_e2e",
            user_id: "usr_e2e",
            stars: 5,
            message: feedbackMessage,
            created_at: "2026-09-08T12:00:00.000Z",
          },
        }),
      );
    if (path.endsWith("/feedback")) {
      state.feedbackRequests.push(url.search);
      const hasCursor = url.searchParams.has("cursor");
      return fulfill(
        200,
        envelope({
          feedback: [
            {
              id: "fbk_e2e",
              user_id: "usr_e2e",
              stars: 5,
              message: feedbackMessage,
              created_at: "2026-09-08T12:00:00.000Z",
            },
          ],
          next_cursor: hasCursor ? null : "cursor-e2e-1",
        }),
      );
    }
    if (path === "/admin/v1/users/usr_e2e" && method === "GET") {
      return fulfill(
        200,
        envelope({
          user: {
            id: "usr_e2e",
            email: "customer@example.com",
            status: "ACTIVE",
            version: 1,
            created_at: "2026-09-08T12:00:00.000Z",
          },
          organizations: [
            {
              id: "org_e2e",
              name: "Customer workspace",
              role: "OWNER",
              state: "ACTIVE",
              plan_code: "free",
            },
          ],
        }),
      );
    }
    if (path === "/admin/v1/users/usr_e2e/tier-assignments" && method === "GET") {
      return fulfill(200, envelope({ assignments: state.tierAssignments }));
    }
    if (path === "/admin/v1/users/usr_e2e/tier-assignments" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      state.tierAssignmentRequests.push({ body, headers });
      const assignment = {
        id: "cta_e2e",
        user_id: "usr_e2e",
        org_id: "org_e2e",
        tier_id: "cti_e2e",
        tier_key: "priority_support",
        tier_name: "Priority support",
        revision_id: "ctr_e2e",
        source: "ADMIN_GRANT",
        billing_mode: "NO_CHARGE_GRANT",
        reason: body.reason,
        starts_at: "2026-09-24T10:00:00.000Z",
        expires_at: "2026-10-24T10:00:00.000Z",
        revoked_at: null,
        status: "ACTIVE",
        version: 1,
        created_by: "adm_e2e",
        created_at: "2026-09-24T10:00:00.000Z",
        updated_at: "2026-09-24T10:00:00.000Z",
      };
      state.tierAssignments = [assignment];
      return fulfill(
        200,
        envelope({
          assignment,
          tier: { id: "ctr_e2e", tier_key: "priority_support", revision: 1 },
        }),
      );
    }
    if (path === "/admin/v1/tiers" && method === "GET") {
      return fulfill(
        200,
        envelope({
          tiers: [
            {
              id: "cti_e2e",
              revision_id: "ctr_e2e",
              tier_id: "cti_e2e",
              key: "priority_support",
              name: "Priority support",
              description: "Support grant",
              state: "ACTIVE",
              billing_mode: "FREE",
              price_kind: "FREE",
              price_usd_minor: 0,
              price_inr_minor: 0,
              interval: "GRANT",
              default_duration_days: 30,
              enforced_limit_keys: [],
              unenforced_limit_keys: [],
              limits: {},
              features: [],
              system: false,
              assignment_count: 0,
              active_assignment_count: 0,
              version: 1,
              revision_version: 1,
              created_at: "2026-09-01T00:00:00.000Z",
              updated_at: "2026-09-01T00:00:00.000Z",
              archived_at: null,
            },
          ],
          next_cursor: null,
        }),
      );
    }
    if (path === "/admin/v1/tiers/cti_e2e" && method === "GET") {
      return fulfill(
        200,
        envelope({
          tier: {
            id: "cti_e2e",
            revision_id: "ctr_e2e",
            tier_id: "cti_e2e",
            key: "priority_support",
            name: "Priority support",
            description: "Support grant",
            state: "ACTIVE",
            billing_mode: "FREE",
            price_kind: "FREE",
            price_usd_minor: 0,
            price_inr_minor: 0,
            interval: "GRANT",
            default_duration_days: 30,
            enforced_limit_keys: [],
            unenforced_limit_keys: [],
            limits: {},
            features: [],
            system: false,
            assignment_count: 0,
            active_assignment_count: 0,
            version: 1,
            revision_version: 1,
            created_at: "2026-09-01T00:00:00.000Z",
            updated_at: "2026-09-01T00:00:00.000Z",
            archived_at: null,
          },
          revisions: [
            {
              id: "ctr_e2e",
              tier_id: "cti_e2e",
              tier_key: "priority_support",
              revision: 1,
              state: "PUBLISHED",
              validation_sha256: "sha256",
              display_name: "Priority support",
              description: "Support grant",
              price_usd_minor: 0,
              price_inr_minor: 0,
              price_kind: "FREE",
              grant_only: true,
              duration_days: 30,
              version: 1,
              created_by: "adm_e2e",
              published_by: "adm_e2e",
              published_at: "2026-09-01T00:00:00.000Z",
              created_at: "2026-09-01T00:00:00.000Z",
              updated_at: "2026-09-01T00:00:00.000Z",
              limits: {},
              features: {},
            },
          ],
          assignments: [],
        }),
      );
    }
    if (path === "/admin/v1/billing/payments/pay_e2e" && method === "GET") {
      return fulfill(
        200,
        envelope({
          payment: {
            id: "pay_e2e",
            invoice_id: "inv_e2e",
            org_id: "org_e2e",
            amount_minor: 500,
            refunded_total_minor: 0,
            currency: "usd",
            status: "CAPTURED",
            method: "card",
            failure_code: null,
            verified_at: "2026-09-24T10:00:00.000Z",
            created_at: "2026-09-24T10:00:00.000Z",
            updated_at: "2026-09-24T10:00:00.000Z",
          },
        }),
      );
    }
    if (path === "/admin/v1/billing/payments/pay_e2e:correct" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      state.paymentCorrectionRequests.push({ path, body, headers });
      if (options.paymentCorrectionUncertain && !state.correctionFailureUsed) {
        state.correctionFailureUsed = true;
        return fulfill(504, errorEnvelope("TIMEOUT", true));
      }
      return fulfill(
        200,
        envelope({ refund_id: "ref_e2e", payment: { id: "pay_e2e", status: "CAPTURED" } }),
      );
    }
    if (path.endsWith("/features") && method === "GET")
      return fulfill(
        200,
        envelope({ features: [{ key: "email_password", enabled: true, version: 1 }] }),
      );
    if (path.includes("/features/email_password") && method === "PATCH") {
      if (options.stepUp && !state.stepUpFailureUsed) {
        state.stepUpFailureUsed = true;
        return fulfill(
          401,
          errorEnvelope("STEP_UP_REQUIRED", false, { action: "admin:feature_flag" }),
        );
      }
      if (!state.csrfFailureUsed) {
        state.csrfFailureUsed = true;
        return fulfill(403, errorEnvelope("ADMIN_CSRF_TOKEN_INVALID"));
      }
      return fulfill(
        200,
        envelope({ feature: { key: "email_password", enabled: false, version: 2 } }),
      );
    }
    if (path.endsWith("/users")) {
      if (state.expireUsers) return fulfill(401, errorEnvelope("ADMIN_SESSION_EXPIRED"));
      return fulfill(200, envelope({ users: [], next_cursor: null }));
    }
    if (path.endsWith("/auth/sessions")) return fulfill(200, envelope({ sessions: [] }));
    return fulfill(200, envelope({}));
  });
  return state;
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Admin email").fill("operator@example.com");
  await page.getByLabel("Password").fill("a-long-admin-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("admin can sign in and open the command palette", async ({ page }) => {
  await mockAdminApi(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.screenshot({
    path: `test-results/admin-dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.getByLabel("Search pages and resources").fill("Users");
  await page.getByRole("button", { name: /Users/ }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
});

test("analyst navigation remains capability derived and a denied route is explicit", async ({
  page,
}) => {
  await mockAdminApi(page, "ANALYST");
  await signIn(page);
  await expect(page.getByRole("link", { name: "Audit log" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(page.getByText("Permission required")).toBeVisible();
});

test("CSRF recovery retries a mutation with the same idempotency key", async ({ page }) => {
  const state = await mockAdminApi(page);
  await signIn(page);
  await page.goto("/features");
  await expect(page.getByRole("heading", { name: "Feature flags" })).toBeVisible();
  await page.getByRole("button", { name: "Disable" }).click();
  await page.getByLabel("Reason").fill("Pause password sign-in during an incident");
  await page.getByRole("button", { name: "Disable feature" }).click();
  await expect(page.getByRole("heading", { name: "Feature flags" })).toBeVisible();
  await expect.poll(() => state.mutationHeaders.length).toBeGreaterThanOrEqual(2);
  expect(state.mutationHeaders[0]?.["idempotency-key"]).toBe(
    state.mutationHeaders[1]?.["idempotency-key"],
  );
  expect(state.mutationHeaders[0]?.["x-csrf-token"]).toBe("browser-csrf");
});

test("step-up continuation repeats the intended mutation with the same key", async ({ page }) => {
  const state = await mockAdminApi(page, "ROOT", { stepUp: true });
  await signIn(page);
  await page.goto("/features");
  await page.getByRole("button", { name: "Disable" }).click();
  await page.getByLabel("Reason").fill("Pause password sign-in during an incident");
  await page.getByRole("button", { name: "Disable feature" }).click();
  await expect(page.getByRole("dialog", { name: "Fresh verification required" })).toBeVisible();
  const stepUp = page.getByRole("dialog", { name: "Fresh verification required" });
  await stepUp.getByLabel("Password", { exact: true }).fill("a-long-admin-password");
  await stepUp.getByLabel("MFA code", { exact: true }).fill("123456");
  await stepUp.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("heading", { name: "Feature flags" })).toBeVisible();
  await expect.poll(() => state.mutationHeaders.length).toBeGreaterThanOrEqual(2);
  const patchHeaders = state.mutationHeaders.filter((headers) => headers["idempotency-key"]);
  expect(patchHeaders.at(-1)?.["idempotency-key"]).toBe(patchHeaders.at(-2)?.["idempotency-key"]);
});

test("session expiry returns to login with a safe internal path", async ({ page }) => {
  const state = await mockAdminApi(page);
  await signIn(page);
  await page.goto("/users");
  await expect(page.getByText("No customers match")).toBeVisible();
  state.expireUsers = true;
  await expect(page.getByRole("button", { name: "Refresh" })).toBeEnabled();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fusers/);
  expect(state.authenticated).toBe(true);
});

test("mobile navigation keeps security controls available", async ({ page }) => {
  await mockAdminApi(page);
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  const navigationLocator = page.getByRole("complementary", { name: "Primary navigation" });
  await expect.poll(async () => (await navigationLocator.boundingBox())?.x).toBe(0);
  await page.screenshot({
    path: `test-results/admin-navigation-${test.info().project.name}.png`,
    fullPage: true,
  });
  await expect(navigationLocator).toBeVisible();
  const navigation = await navigationLocator.boundingBox();
  expect(navigation?.x).toBeGreaterThanOrEqual(0);
  expect(navigation?.width).toBeGreaterThan(200);
  await expect(page.getByRole("link", { name: "Security settings" })).toBeVisible();
});

test("audit and operations navigation resolve to implemented protected routes", async ({
  page,
}) => {
  await mockAdminApi(page);
  await signIn(page);
  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await page.goto("/system");
  await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Health" })).toBeVisible();
});

test("customer feedback is a read-only admin projection", async ({ page }) => {
  await mockAdminApi(page);
  await signIn(page);
  await page.goto("/feedback");
  await expect(page.getByRole("heading", { name: "Customer feedback" })).toBeVisible();
  await expect(page.getByText("The main website is clear and easy to use.")).toBeVisible();
  await expect(page.getByText("Read only").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Submit|Create|Save/ })).toHaveCount(0);
  await page.getByRole("link", { name: /The main website is clear/ }).click();
  await expect(page).toHaveURL(/\/feedback\/fbk_e2e$/);
  await expect(page.getByRole("heading", { name: "Feedback detail" })).toBeVisible();
});

test("feedback filters reset signed cursors and long messages stay safe on narrow screens", async ({
  page,
}) => {
  const state = await mockAdminApi(page, "ROOT", { longFeedback: true });
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/feedback");
  await expect(page.getByRole("heading", { name: "Customer feedback" })).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect.poll(() => state.feedbackRequests.length).toBeGreaterThanOrEqual(2);
  expect(new URL(`http://localhost${state.feedbackRequests[1]}`).searchParams.get("cursor")).toBe(
    "cursor-e2e-1",
  );

  await page.getByLabel("Stars", { exact: true }).selectOption("5");
  await page.getByLabel("Sort", { exact: true }).selectOption("stars");
  await page.getByLabel("Order", { exact: true }).selectOption("asc");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect.poll(() => state.feedbackRequests.length).toBeGreaterThanOrEqual(3);
  const resetQuery = new URL(`http://localhost${state.feedbackRequests[2]}`).searchParams;
  expect(resetQuery.has("cursor")).toBe(false);
  expect(resetQuery.get("stars")).toBe("5");
  expect(resetQuery.get("sort_by")).toBe("stars");
  expect(resetQuery.get("sort_order")).toBe("asc");

  await page.getByRole("link", { name: /not executable/ }).click();
  const message = page.getByLabel("Customer message");
  await expect(message).toContainText("<script>not executable</script>");
  expect(await message.locator("script").count()).toBe(0);
  expect(
    await message.evaluate((element) => ({
      overflowWrap: getComputedStyle(element).overflowWrap,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    })),
  ).toMatchObject({ overflowWrap: "anywhere" });
  const dimensions = await message.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  await page.goto("/feedback");
  const refresh = page.getByRole("button", { name: "Refresh", exact: true });
  await expect(refresh).toBeEnabled();
  await refresh.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(refresh).toBeFocused();
  const focusedOutline = await refresh.evaluate((element) => ({
    focusVisible: element.matches(":focus-visible"),
    outlineStyle: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth,
  }));
  expect(focusedOutline.focusVisible).toBe(true);
  expect(focusedOutline?.outlineStyle).toBe("solid");
  expect(focusedOutline?.outlineWidth).toBe("3px");
});

test("payment corrections use the classified :correct route and retain the key for a manual retry", async ({
  page,
}) => {
  const state = await mockAdminApi(page, "ROOT", { paymentCorrectionUncertain: true });
  await signIn(page);
  await page.goto("/billing/payments/pay_e2e");
  await expect(page.getByRole("heading", { name: "pay_e2e" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Correct payment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Issue refund" })).toHaveCount(0);
  await page.getByRole("button", { name: "Correct payment" }).click();
  await page.getByLabel("Correction class").selectOption("PROVIDER_CORRECTION");
  await page.getByLabel("Amount in minor units").fill("250");
  await page.getByLabel("Reason").fill("Verified duplicate capture correction");
  await page.getByRole("button", { name: "Submit correction" }).click();
  await expect(page.getByText("Correction not completed", { exact: true })).toBeVisible();
  expect(state.paymentCorrectionRequests).toHaveLength(1);
  await page.getByRole("button", { name: "Submit correction" }).click();
  await expect(page.getByRole("heading", { name: "Billing action accepted" })).toBeVisible();
  expect(state.paymentCorrectionRequests).toHaveLength(2);
  const [first, second] = state.paymentCorrectionRequests;
  expect(first?.path).toBe("/admin/v1/billing/payments/pay_e2e:correct");
  expect(first?.body).toEqual({
    correction_class: "PROVIDER_CORRECTION",
    amount_minor: 250,
    reason: "Verified duplicate capture correction",
  });
  expect(second?.body).toEqual(first?.body);
  expect(first?.headers["idempotency-key"]).toBe(second?.headers["idempotency-key"]);
  expect(first?.headers["x-csrf-token"]).toBe("browser-csrf");
  expect(first?.path).not.toContain(":refund");
});

test("customer detail assigns a published custom tier only to an owned organization", async ({
  page,
}) => {
  const state = await mockAdminApi(page);
  await signIn(page);
  await page.goto("/users/usr_e2e");
  await expect(page.getByRole("heading", { name: "customer@example.com" })).toBeVisible();
  await expect(page.getByText("No custom tier assignments")).toBeVisible();
  await page.getByRole("button", { name: "Grant tier" }).click();
  await page.getByRole("combobox", { name: "Custom tier" }).selectOption("cti_e2e");
  await expect(page.getByText("Pinned to published revision 1.")).toBeVisible();
  await page.getByLabel("Reason").fill("Approved customer support grant");
  await page.getByRole("button", { name: "Assign grant" }).click();
  await expect(page.getByText(/created a no-charge grant/)).toBeVisible();
  await expect(page.getByText("Priority support").last()).toBeVisible();
  expect(state.tierAssignmentRequests).toHaveLength(1);
  expect(state.tierAssignmentRequests[0]?.body).toEqual({
    org_id: "org_e2e",
    tier_id: "cti_e2e",
    revision_id: "ctr_e2e",
    duration_days: 30,
    expected_version: 0,
    replace_active: false,
    reason: "Approved customer support grant",
  });
  expect(state.tierAssignmentRequests[0]?.headers["idempotency-key"]).toMatch(/^admin_/);
  expect(state.tierAssignmentRequests[0]?.headers["x-csrf-token"]).toBe("browser-csrf");
});

test("deployment confirmation, progress, logs, and refresh use the durable operation journal", async ({
  page,
}) => {
  const state = await mockAdminApi(page);
  await signIn(page);
  await page.goto("/deploy");
  await expect(page.getByRole("heading", { name: "Deploy Havenerr" })).toBeVisible();
  const deploy = page.getByRole("button", { name: "Deploy bbbbbbbbbbbb", exact: true }).first();
  await expect(deploy).toBeEnabled();
  await deploy.click();

  const confirmation = page.getByRole("dialog", { name: "Deploy reviewed commit" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByLabel("Exact target")).toHaveValue(/a{40} → b{40}/);
  await confirmation.getByLabel("Reason").fill("Deploy reviewed operator release");
  await confirmation.getByRole("button", { name: "Deploy bbbbbbbbbbbb", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Operation dpl_deploy_e2e" })).toBeVisible();
  await expect(page.getByText("Build and run tests")).toBeVisible();
  await expect(page.getByText("Candidate build passed.")).toBeVisible();
  expect(state.deploymentRequests[0]?.path).toBe("/admin/v1/deployments");
  expect(state.deploymentRequests[0]?.body).toEqual({
    candidate_sha: "b".repeat(40),
    reason: "Deploy reviewed operator release",
  });
  expect(state.deploymentRequests[0]?.headers["x-csrf-token"]).toBe("browser-csrf");
  expect(state.deploymentRequests[0]?.headers["idempotency-key"]).toMatch(/^admin_/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Operation dpl_deploy_e2e" })).toBeVisible();
  await expect(page.getByText("Candidate build passed.")).toBeVisible();
});

test("manual rollback requires typed confirmation and targets a retained release", async ({
  page,
}) => {
  const state = await mockAdminApi(page);
  await signIn(page);
  await page.goto("/deploy");
  const rollback = page.getByRole("button", { name: "Roll back to aaaaaaaaaaaa" });
  await expect(rollback).toBeVisible();
  await rollback.click();
  await page.getByLabel("Type ROLLBACK to continue").fill("ROLLBACK");
  await page
    .getByLabel("Reason", { exact: true })
    .last()
    .fill("Restore previously verified release");
  await page.getByRole("button", { name: "Request rollback" }).click();
  await expect(page.getByRole("heading", { name: "Operation dpl_rollback_e2e" })).toBeVisible();
  expect(state.deploymentRequests[0]?.path).toBe("/admin/v1/deployments/dpl_previous_e2e:rollback");
  expect(state.deploymentRequests[0]?.body).toEqual({
    target_release_id: "dpl_previous_e2e",
    confirmation: "ROLLBACK",
    reason: "Restore previously verified release",
  });
});

test("configuration validation and save use typed allowlisted changes", async ({ page }) => {
  const state = await mockAdminApi(page);
  await signIn(page);
  await page.goto("/system/config");
  await expect(page.getByRole("heading", { name: "Runtime configuration" })).toBeVisible();
  await expect(page.getByText("Masked", { exact: true })).toBeVisible();
  await expect(page.getByText("db_live_fixture_secret_4422")).toHaveCount(0);
  await page.getByLabel("LOG_LEVEL").fill("debug");
  await page.getByRole("button", { name: "Validate candidate" }).click();
  await expect(page.getByText("Candidate configuration passed validation.")).toBeVisible();
  await page.getByLabel("Save reason").fill("Reduce log volume during investigation");
  await page.getByRole("button", { name: "Save configuration" }).click();
  await expect(page.getByText("Restart required", { exact: false })).toBeVisible();
  expect(state.configRequests.map((request) => request.path)).toEqual([
    "/admin/v1/system/config/validate",
    "/admin/v1/system/config",
  ]);
  expect(state.configRequests[0]?.body).toEqual({
    changes: [{ key: "LOG_LEVEL", value: "debug" }],
  });
  expect(state.configRequests[1]?.method).toBe("PUT");
  expect(state.configRequests[1]?.body).toMatchObject({
    changes: [{ key: "LOG_LEVEL", value: "debug" }],
    expected_revision: "c".repeat(64),
    reason: "Reduce log volume during investigation",
  });
  expect(state.configRequests[1]?.headers["idempotency-key"]).toMatch(/^admin_/);
});

test("secret reveal is a separate transient action and does not include the value in its request", async ({
  page,
}) => {
  const state = await mockAdminApi(page);
  await signIn(page);
  await page.goto("/system/secrets");
  await expect(page.getByRole("heading", { name: "Secret files" })).toBeVisible();
  await expect(page.getByText("secret-reveal-e2e")).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal once" }).first().click();
  await page.getByLabel("Reason", { exact: true }).fill("Inspect credential after rotation");
  await page.getByRole("button", { name: "Reveal once" }).last().click();
  await expect(page.getByText("secret-reveal-e2e")).toBeVisible();
  expect(state.secretRequests[0]?.path).toBe("/admin/v1/system/secrets/database-password:reveal");
  expect(state.secretRequests[0]?.body).toEqual({ reason: "Inspect credential after rotation" });
  expect(JSON.stringify(state.secretRequests[0]?.body)).not.toContain("secret-reveal-e2e");
  await page.getByRole("button", { name: "Hide now" }).click();
  await expect(page.getByText("secret-reveal-e2e")).toHaveCount(0);
});

test("runtime restart reconnects and reports success only after readiness returns", async ({
  page,
}) => {
  const state = await mockAdminApi(page);
  await signIn(page);
  await page.goto("/system/runtime");
  await expect(page.getByRole("heading", { name: "Runtime and restart" })).toBeVisible();
  await page.getByRole("button", { name: "Restart backend" }).click();
  const dialog = page.getByRole("dialog", { name: "Restart Havenerr backend" });
  await dialog.getByLabel("Reason").fill("Apply reviewed runtime configuration");
  await dialog.getByRole("button", { name: "Queue restart" }).click();
  await expect(page.getByText(/Waiting for the API to reconnect/)).toBeVisible();
  await expect(page.getByText(/Restart completed\. Readiness is restored/)).toBeVisible({
    timeout: 15000,
  });
  expect(state.restartRequests).toHaveLength(1);
  expect(state.restartRequests[0]?.body).toEqual({
    reason: "Apply reviewed runtime configuration",
  });
  expect(state.restartRequests[0]?.headers["idempotency-key"]).toMatch(/^admin_/);
});

test("security headers protect the control-panel document", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toMatch(/no-store|no-cache/);
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain("connect-src 'self'");
});

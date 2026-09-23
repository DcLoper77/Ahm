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
  };
  const feedbackMessage = options.longFeedback
    ? `<script>not executable</script>${"x".repeat(1940)}`
    : "The main website is clear and easy to use.";
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

test("security headers protect the control-panel document", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toMatch(/no-store|no-cache/);
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain("connect-src 'self'");
});

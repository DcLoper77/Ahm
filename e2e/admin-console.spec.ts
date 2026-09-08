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

async function mockAdminApi(page: Page, role: Role = "ROOT", options: { stepUp?: boolean } = {}) {
  const state = {
    authenticated: false,
    csrfFailureUsed: false,
    stepUpFailureUsed: false,
    expireUsers: false,
    mutationHeaders: [] as Record<string, string>[],
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
          workers: "healthy",
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
            message: "The main website is clear and easy to use.",
            created_at: "2026-09-08T12:00:00.000Z",
          },
        }),
      );
    if (path.endsWith("/feedback"))
      return fulfill(
        200,
        envelope({
          feedback: [
            {
              id: "fbk_e2e",
              user_id: "usr_e2e",
              stars: 5,
              message: "The main website is clear and easy to use.",
              created_at: "2026-09-08T12:00:00.000Z",
            },
          ],
          next_cursor: null,
        }),
      );
    if (path.endsWith("/features") && method === "GET")
      return fulfill(200, envelope({ features: [{ key: "hosting", enabled: true, version: 1 }] }));
    if (path.includes("/features/hosting") && method === "PATCH") {
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
      return fulfill(200, envelope({ key: "hosting", enabled: false, version: 2 }));
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
  await page.getByLabel("Reason").fill("Pause new hosting intent during an incident");
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
  await page.getByLabel("Reason").fill("Pause new hosting intent during an incident");
  await page.getByRole("button", { name: "Disable feature" }).click();
  await expect(page.getByRole("dialog", { name: "Fresh verification required" })).toBeVisible();
  await page.getByLabel("Password").fill("a-long-admin-password");
  await page.getByLabel("MFA code").fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
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
  await expect(page.getByRole("complementary", { name: "Primary navigation" })).toBeVisible();
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

test("security headers protect the control-panel document", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toMatch(/no-store|no-cache/);
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain(
    "connect-src 'self' https://api.havenerr.com",
  );
});

import { expect, test } from "@playwright/test";

function success(data: unknown) {
  return { success: true, data, request_id: "req_mfa_e2e" };
}

function failure(code: string) {
  return {
    success: false,
    error: {
      code,
      message: "test response",
      retryable: false,
      documentation_url: "https://docs.havenerr.com/errors",
    },
    request_id: "req_mfa_e2e_error",
  };
}

test("new admin can scan a locally generated QR, confirm MFA, and reach the console", async ({
  page,
}) => {
  let authenticated = false;
  let mfaEnabled = false;
  const setupUri =
    "otpauth://totp/Havenerr%3Aoperator%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Havenerr";

  await page
    .context()
    .addCookies([{ name: "hv_admin_csrf", value: "browser-csrf", domain: "localhost", path: "/" }]);
  await page.route(/\/admin\/v1\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const fulfill = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (path.endsWith("/auth/me") && method === "GET") {
      if (!authenticated) return fulfill(401, failure("ADMIN_SESSION_EXPIRED"));
      if (!mfaEnabled) return fulfill(401, failure("ADMIN_MFA_REQUIRED"));
      return fulfill(
        200,
        success({
          id: "adm_mfa_e2e",
          email: "operator@example.com",
          roles: ["ROOT"],
          permissions: ["*"],
          assignable_roles: ["ROOT"],
          mfa_enabled: true,
          mfa_satisfied: true,
          session_id: "ase_mfa_e2e",
        }),
      );
    }
    if (path.endsWith("/auth/login") && method === "POST") {
      authenticated = true;
      return fulfill(
        200,
        success({
          admin_user_id: "adm_mfa_e2e",
          roles: ["ROOT"],
          mfa_enrollment_required: true,
          idle_expires_at: "2026-09-27T20:00:00.000Z",
          absolute_expires_at: "2026-09-28T12:00:00.000Z",
        }),
        { "set-cookie": "hv_admin_sess=e2e-session; Path=/; HttpOnly; SameSite=Lax" },
      );
    }
    if (path.endsWith("/auth/mfa/enroll") && method === "POST") {
      return fulfill(200, success({ secret: "JBSWY3DPEHPK3PXP", otpauth_uri: setupUri }));
    }
    if (path.endsWith("/auth/mfa/confirm") && method === "POST") {
      mfaEnabled = true;
      return fulfill(200, success({ recovery_codes: ["ABCD-EFGH"] }));
    }
    return fulfill(200, success({}));
  });

  await page.goto("/login");
  await page.getByLabel("Admin email").fill("operator@example.com");
  await page.getByLabel("Password").fill("a-long-admin-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/mfa\/enroll$/);

  const qr = page.getByRole("img", { name: "Authenticator setup QR code" });
  await expect(qr).toBeVisible();
  const source = await qr.getAttribute("src");
  expect(source).toMatch(/^data:image\/png;base64,/);
  await expect(page.getByText("Scan with your authenticator")).toBeVisible();
  await page.screenshot({ path: `test-results/admin-mfa-${test.info().project.name}.png` });

  await page.getByLabel("Confirmation code").fill("123456");
  await page.getByRole("button", { name: "Confirm MFA" }).click();
  await expect(page.getByRole("heading", { name: "Save your recovery codes" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to control panel" }).click();
  await expect(page).toHaveURL(/\/$/);
});

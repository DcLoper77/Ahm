import { expect, test } from "@playwright/test";

test("same-origin API rewrite preserves Strict session and CSRF cookies across login and logout", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Admin email").fill("operator@example.com");
  await page.getByLabel("Password").fill("fixture password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  if (test.info().project.name === "chromium") {
    await expect(page.getByText("operator@example.com")).toBeVisible();
  }

  const browserCookies = await page.context().cookies("http://localhost:3000/admin/v1/auth/me");
  const sessionCookie = browserCookies.find((cookie) => cookie.name === "hv_admin_sess");
  const csrfCookie = browserCookies.find((cookie) => cookie.name === "hv_admin_csrf");
  expect(sessionCookie).toMatchObject({
    domain: "localhost",
    path: "/admin/v1",
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
  });
  expect(csrfCookie).toMatchObject({
    domain: "localhost",
    path: "/",
    secure: true,
    httpOnly: false,
    sameSite: "Strict",
  });
  expect(await page.context().cookies("http://127.0.0.1:5000")).toEqual([]);

  const beforeLogoutResponse = await page.request.get("http://127.0.0.1:5000/fixture/state");
  const beforeLogout = (await beforeLogoutResponse.json()).data;
  expect(beforeLogout.authenticatedMeRequests).toBeGreaterThan(0);
  expect(beforeLogout.setCookie).toHaveLength(2);
  expect(beforeLogout.setCookie.join("\n")).not.toMatch(/domain=/i);
  expect(beforeLogout.setCookie[0]).toMatch(/Secure; HttpOnly; SameSite=Strict/);
  expect(beforeLogout.setCookie[1]).toMatch(/Secure; SameSite=Strict/);

  if (test.info().project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("complementary", { name: "Primary navigation" })
      .getByRole("button", { name: "Sign out" })
      .click();
  } else {
    await page.getByRole("banner").getByRole("button", { name: "Sign out" }).click();
  }
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  const afterLogoutResponse = await page.request.get("http://127.0.0.1:5000/fixture/state");
  const afterLogout = (await afterLogoutResponse.json()).data;
  expect(afterLogout.logout).toMatchObject({
    sessionPresent: true,
    csrfCookiePresent: true,
    csrfHeaderMatches: true,
  });
  expect(afterLogout.logout.cookieHeader).toContain("hv_admin_sess=fixture-admin-session");
  expect(afterLogout.logout.csrfHeader).toBe("fixture-admin-csrf");
  expect(await page.context().cookies("http://localhost:3000/admin/v1/auth/me")).toEqual([]);
});

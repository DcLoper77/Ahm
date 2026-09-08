import { describe, expect, it } from "vitest";
import { hasPermission, permissionsForRoles } from "./rbac";

describe("admin role permissions", () => {
  it("keeps the final six-role matrix exact", () => {
    expect([...permissionsForRoles(["SUPPORT_OPERATOR"])]).toEqual([
      "users.read",
      "orgs.read",
      "users.suspend",
      "orgs.suspend",
      "catalog.read",
      "quotas.read",
      "quotas.write",
    ]);
    expect(hasPermission(["ANALYST"], "analytics.read")).toBe(true);
    expect(hasPermission(["ANALYST"], "users.read")).toBe(false);
    expect(hasPermission(["PLATFORM_ADMIN"], "billing.read")).toBe(false);
    expect(hasPermission(["ROOT"], "billing.write")).toBe(true);
  });
});

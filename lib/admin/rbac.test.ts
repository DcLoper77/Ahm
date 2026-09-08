import { describe, expect, it } from "vitest";
import { canGrantRole, hasPermission, permissionsForRoles } from "./rbac";

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

  it("only allows role grants whose complete immutable permission set is held", () => {
    expect(canGrantRole(["PLATFORM_ADMIN"], "PLATFORM_ADMIN")).toBe(true);
    expect(canGrantRole(["PLATFORM_ADMIN"], "BILLING_ADMIN")).toBe(false);
    expect(canGrantRole(["BILLING_ADMIN"], "BILLING_ADMIN")).toBe(true);
    expect(canGrantRole(["ANALYST"], "ROOT")).toBe(false);
    expect(canGrantRole(["ROOT"], "ROOT")).toBe(true);
  });
});

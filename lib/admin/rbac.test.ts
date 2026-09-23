import { describe, expect, it } from "vitest";
import { canGrantRole, hasAnyPermission, hasPermission } from "./rbac";

describe("server-provided admin permissions", () => {
  it("checks effective permissions without a frontend role matrix", () => {
    const permissions = ["billing.read", "billing.correction"] as const;
    expect(hasPermission(permissions, "billing.correction")).toBe(true);
    expect(hasPermission(permissions, "billing.write")).toBe(false);
    expect(hasAnyPermission(permissions, ["system.read", "billing.read"])).toBe(true);
    expect(hasPermission(["*"], "tiers.assign")).toBe(true);
  });

  it("uses the server's grantable-role projection", () => {
    expect(canGrantRole(["ANALYST", "BILLING_ADMIN"], "ANALYST")).toBe(true);
    expect(canGrantRole(["ANALYST", "BILLING_ADMIN"], "ROOT")).toBe(false);
  });
});

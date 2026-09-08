import { describe, expect, it } from "vitest";
import { isSensitiveKey, safeScalar } from "./format";

describe("admin projection redaction", () => {
  it("redacts secret-adjacent fields from unknown projections", () => {
    for (const key of [
      "password",
      "mfa_secret",
      "recovery_codes",
      "provider_payload",
      "database_password",
      "connection_url",
      "api_key",
      "environment",
      "gateway_reference",
    ]) {
      expect(isSensitiveKey(key), key).toBe(true);
    }
    expect(isSensitiveKey("status")).toBe(false);
    expect(isSensitiveKey("failed_resources")).toBe(false);
  });

  it("keeps scalar safe projections renderable without serializing objects", () => {
    expect(safeScalar("ACTIVE")).toBe("ACTIVE");
    expect(safeScalar(42)).toBe(42);
    expect(safeScalar({ value: "secret" })).toBeNull();
    expect(safeScalar(["token"])).toBeNull();
  });
});

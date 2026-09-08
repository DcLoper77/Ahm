import { describe, expect, it } from "vitest";
import { isRetryableCode, safeMessageForCode } from "./errors";

describe("admin error catalogue", () => {
  it("keeps degraded and async infrastructure failures retryable", () => {
    for (const code of [
      "IDEMPOTENCY_IN_PROGRESS",
      "DEPENDENCY_UNAVAILABLE",
      "WORKER_UNAVAILABLE",
      "TIMEOUT",
      "SERVICE_DEGRADED",
      "DATABASE_POOL_EXHAUSTED",
    ]) {
      expect(isRetryableCode(code), code).toBe(true);
      expect(safeMessageForCode(code)).not.toContain("test response");
    }
  });

  it("does not present internal/provider evidence as a direct browser control", () => {
    expect(isRetryableCode("WORKER_SIGNATURE_INVALID")).toBe(false);
    expect(safeMessageForCode("UPSTREAM_RESPONSE_INVALID")).toContain("automatic repeat");
    expect(safeMessageForCode("unknown-code")).toBe(
      "The admin service could not complete the request.",
    );
  });
});

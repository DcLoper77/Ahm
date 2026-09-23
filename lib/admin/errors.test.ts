import { describe, expect, it } from "vitest";
import { isRetryableCode, safeMessageForCode } from "./errors";

describe("admin error catalogue", () => {
  it("keeps transient service failures retryable", () => {
    for (const code of [
      "IDEMPOTENCY_IN_PROGRESS",
      "DEPENDENCY_UNAVAILABLE",
      "RESOURCE_BUSY",
      "TIMEOUT",
      "SERVICE_DEGRADED",
      "DATABASE_POOL_EXHAUSTED",
    ]) {
      expect(isRetryableCode(code), code).toBe(true);
      expect(safeMessageForCode(code)).not.toContain("test response");
    }
  });

  it("keeps unknown internal errors generic", () => {
    expect(isRetryableCode("INVALID_SIGNATURE")).toBe(false);
    expect(isRetryableCode("CREDENTIAL_REVEAL_REPLAY_UNAVAILABLE")).toBe(false);
    expect(safeMessageForCode("CREDENTIAL_REVEAL_REPLAY_UNAVAILABLE")).toContain(
      "cannot be shown again",
    );
    expect(safeMessageForCode("UPSTREAM_RESPONSE_INVALID")).toContain("automatic repeat");
    expect(safeMessageForCode("unknown-code")).toBe(
      "The admin service could not complete the request.",
    );
  });
});

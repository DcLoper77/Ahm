import { describe, expect, it } from "vitest";
import { resolveAdminApiUpstream } from "./upstream";

describe("Admin API server-only upstream configuration", () => {
  it("accepts loopback HTTP for local development and HTTPS origins for previews", () => {
    expect(
      resolveAdminApiUpstream({ HAVENERR_ADMIN_UPSTREAM_ORIGIN: "http://127.0.0.1:5000" }),
    ).toBe("http://127.0.0.1:5000");
    expect(
      resolveAdminApiUpstream({
        HAVENERR_ADMIN_UPSTREAM_ORIGIN: "https://api.staging.example",
        VERCEL: "1",
        VERCEL_ENV: "preview",
      }),
    ).toBe("https://api.staging.example");
  });

  it("requires explicit config and rejects paths, credentials, wildcard and non-loopback HTTP in development", () => {
    for (const origin of [
      "https://api.example/admin/v1",
      "https://user:password@api.example",
      "*",
      "http://api.example",
    ]) {
      expect(() => resolveAdminApiUpstream({ HAVENERR_ADMIN_UPSTREAM_ORIGIN: origin })).toThrow();
    }
  });

  it("pins Vercel and production to https://api.havenerr.com", () => {
    expect(
      resolveAdminApiUpstream({
        HAVENERR_ADMIN_UPSTREAM_ORIGIN: "https://api.havenerr.com",
        VERCEL: "1",
        VERCEL_ENV: "production",
      }),
    ).toBe("https://api.havenerr.com");
    expect(
      resolveAdminApiUpstream({
        HAVENERR_ADMIN_UPSTREAM_ORIGIN: "https://api.staging.example",
        VERCEL: "1",
        VERCEL_ENV: "production",
      }),
    ).toBe("https://api.havenerr.com");
    expect(
      resolveAdminApiUpstream({
        HAVENERR_ADMIN_UPSTREAM_ORIGIN: "http://127.0.0.1:5000",
        VERCEL: "1",
        VERCEL_ENV: "preview",
      }),
    ).toBe("https://api.havenerr.com");
    expect(
      resolveAdminApiUpstream({
        HAVENERR_ADMIN_UPSTREAM_ORIGIN: "http://api.havenerr.com",
        VERCEL: "1",
        VERCEL_ENV: "production",
      }),
    ).toBe("https://api.havenerr.com");
    expect(
      resolveAdminApiUpstream({
        HAVENERR_ADMIN_UPSTREAM_ORIGIN: "http://api.havenerr.com",
      }),
    ).toBe("https://api.havenerr.com");
    expect(
      resolveAdminApiUpstream({
        VERCEL: "1",
        VERCEL_ENV: "production",
      }),
    ).toBe("https://api.havenerr.com");
    expect(resolveAdminApiUpstream({})).toBe("https://api.havenerr.com");
  });
});

const PRODUCTION_ADMIN_API_ORIGIN = "https://api.havenerr.com";

/** Resolve the server-only origin used by the Next.js same-origin rewrite. The browser never
 * receives this value; production is pinned to the documented API host and only local loopback
 * may use HTTP during development. */
export function resolveAdminApiUpstream(env: Readonly<Record<string, string | undefined>>): string {
  const raw = env.HAVENERR_ADMIN_UPSTREAM_ORIGIN;
  if (!raw) {
    throw new Error(
      "HAVENERR_ADMIN_UPSTREAM_ORIGIN is required. Set it to http://127.0.0.1:5000 for local development or https://api.havenerr.com in Vercel production.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("HAVENERR_ADMIN_UPSTREAM_ORIGIN must be an absolute HTTP(S) origin.");
  }

  if (parsed.origin !== raw || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      "HAVENERR_ADMIN_UPSTREAM_ORIGIN must contain only an origin, with no credentials, path, query, or fragment.",
    );
  }

  const localHost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname);
  const localDevelopment = env.VERCEL !== "1" && parsed.protocol === "http:" && localHost;
  if (parsed.protocol !== "https:" && !localDevelopment) {
    throw new Error(
      "HAVENERR_ADMIN_UPSTREAM_ORIGIN must use HTTPS except for a loopback local development API.",
    );
  }

  if (env.VERCEL_ENV === "production" && parsed.origin !== PRODUCTION_ADMIN_API_ORIGIN) {
    throw new Error(
      `Vercel production must use ${PRODUCTION_ADMIN_API_ORIGIN} as HAVENERR_ADMIN_UPSTREAM_ORIGIN.`,
    );
  }

  return parsed.origin;
}

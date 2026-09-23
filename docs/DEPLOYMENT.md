# Admin Control Panel deployment boundary

Production UI origin: `https://controlpanel.havenerr.info`

Backend API origin: `https://api.havenerr.com`
Browser API path: same-origin `/admin/v1/*`

## Request and cookie path

The browser sends credentialed requests to `/admin/v1/*` on the Control Panel origin. Next.js
rewrites that path server-side to the same path on the API origin. The rewrite does not add or remove
an API prefix. The API remains the authentication, validation, authorization, audit, and response
authority.

Because the browser sees a same-origin request, the opaque `hv_admin_sess` cookie is first-party and
can use `Secure; HttpOnly; SameSite=Strict; Path=/admin/v1` without relying on third-party cookies.
The CSRF cookie is host-only, readable, `Secure; SameSite=Strict; Path=/`; the client echoes it as
`X-CSRF-Token`. Both cookies omit `Domain`. The server still validates the token against the exact
SQL-backed admin session and requires `Idempotency-Key` on mutations.

The backend CORS allowlist remains one exact configured origin. Production uses
`https://controlpanel.havenerr.info`; local development can use `http://localhost:3000`. CORS never
uses `*`, suffix matching, or origin reflection. Production browser traffic does not depend on CORS
because it stays same-origin, while exact CORS remains a defense for direct integration probes.

## Configuration

Set `HAVENERR_ADMIN_UPSTREAM_ORIGIN` in the Next.js server/build environment:

- local: `http://127.0.0.1:5000` (loopback HTTP only);
- preview: the explicit HTTPS staging API origin;
- production: `https://api.havenerr.com`.

The setting is server-only and is not bundled into client JavaScript. Vercel rewrites are build-time
configuration, so changing the target requires a new build/deployment. Missing values, paths,
credentials, wildcard hosts, non-loopback HTTP, and a noncanonical Vercel production origin fail
configuration validation.

The Fastify API must be reachable from the Vercel rewrite and must use TLS in production. Its Caddy
proxy forwards only trusted loopback proxy headers; the Node process trusts only loopback peers, as
configured in `D:\API - Havenerr\src\http\server.ts`. Do not publish the VPS origin IP or bypass
the configured API hostname.

## Request IP and rate limits

The backend intentionally trusts forwarded client addresses only from loopback Caddy, and Caddy
sets `X-Forwarded-For` to its immediate peer. With the current Vercel external rewrite, Admin request
IP metadata and the coarse per-IP bucket therefore represent the Vercel-to-API peer, not the
operator's browser. Per-admin session limits and per-email login limits remain separate. Confirm
the aggregate behavior and audit IP in a controlled preview. Do not make Fastify trust arbitrary
forwarded headers or pass through a browser-supplied `X-Forwarded-For`; if individual browser IP
attribution or per-IP throttling is required, add authenticated forwarding or a trusted ingress
before relying on it.

## Verification boundary

Local Playwright coverage verifies the rewrite, cookie scope, CSRF header, session request, logout,
and desktop/mobile rendering against a disposable mock upstream. Backend injection tests verify the
cookie flags, exact CORS origin, preflight, RBAC, and response envelopes. These checks do not prove
Vercel deployment, DNS, TLS, the deployed reverse proxy, live MySQL/Redis, or production admin
accounts. Exercise those gates against a controlled deployed preview before production cutover.

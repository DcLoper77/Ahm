# Havenerr Admin Control Panel

The Vercel hosted administrative control panel for `controlpanel.havenerr.info`.

The browser calls the same-origin `/admin/v1` path. Next.js rewrites that path to the documented
`https://api.havenerr.com/admin/v1` backend boundary, so the host-only admin session cookie is
first-party at `controlpanel.havenerr.info` and does not rely on third-party-cookie support. Admin
sessions remain opaque `HttpOnly` cookies; the readable CSRF cookie is echoed for mutations and
logical mutations reuse their idempotency key after step-up or an uncertain network result.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

The example points the server-only rewrite at `http://127.0.0.1:5000`; use an explicit HTTPS
staging origin for a remote preview. The frontend does not accept customer sessions, PATs, provider
credentials, invitation secrets, MFA secrets, recovery codes, or payment payloads through
environment variables.

Vercel production must set the server-only build variable
`HAVENERR_ADMIN_UPSTREAM_ORIGIN=https://api.havenerr.com`. The build fails if it is missing or
invalid; production does not expose the upstream origin to browser JavaScript. Vercel rewrites are
build-time configuration, so changing the backend origin requires a new deployment.

## Checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Browser checks use Playwright contract mocks plus a local upstream fixture to verify same-origin
rewrites, cookie scope, CSRF and authenticated requests. They do not claim to prove production
Vercel, backend, database, provider, or DNS behavior.

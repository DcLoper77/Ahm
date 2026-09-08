# Havenerr Admin Control Panel

The Vercel hosted administrative control panel for `controlpanel.havenerr.com`.

The browser talks only to the documented `https://api.havenerr.com/admin/v1` boundary. Admin
sessions remain opaque `HttpOnly` cookies; the readable `hv_admin_csrf` cookie is echoed for
mutations and each logical mutation receives a stable idempotency key.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` when using a non-production API origin. The frontend does not
accept customer sessions, PATs, provider credentials, invitation secrets, MFA secrets, recovery
codes, or payment payloads through environment variables.

## Checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Browser checks use Playwright and are intentionally contract-oriented: they mock only the public
admin boundary in isolated test routes and never pretend to prove external worker/provider state.

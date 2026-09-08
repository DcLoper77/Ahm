# Havenerr admin frontend handoff

Entries are newest first. The backend repository is read-only for this project.

## 2026-09-08 - Codex - AF-0 through AF-4 UI baseline

Status: repository baseline committed; live integration and Vercel cutover held.

Pages/components/API modules: Next.js 16 App Router shell; light Havenerr design tokens; responsive
sidebar/topbar/command palette; login, MFA enrollment, invitation acceptance, security/session list;
overview; users and organizations; catalogue, features, quotas; hosting, deployments, domains,
databases, HavenVPS; subscriptions, invoices, payments, refunds; administrators; audit and system
operations. Shared modules live under `lib/admin`, `components/auth`, `components/infra`, and
`components/billing`.

Permission/step-up/destructive decisions: `ROLE_PERMISSIONS` mirrors the six roles and documented
permissions. The backend remains authoritative. Mutations use credentialed cookies, readable
`hv_admin_csrf`, `X-CSRF-Token`, stable `Idempotency-Key`, safe error mapping, bounded retries, and
fresh login/MFA continuation for `STEP_UP_REQUIRED`. Destructive and money-moving flows require an
explicit target/reason/version confirmation. No customer, worker, provider, PayU, shell, credential,
raw payment, environment-value, certificate-key, or database-password route is called.

Commands/tests/browser evidence: `npm.cmd run typecheck`, `npm.cmd run lint`,
`npm.cmd run format:check`, `npm.cmd test` (8 tests), `npm.cmd run build`, and Playwright desktop plus
mobile smoke tests (10 tests) pass. The browser tests use an isolated same-origin mock of the public
admin boundary and prove login, role-derived navigation, permission denial, CSRF retry with the same
idempotency key, session expiry, command palette, and mobile navigation. They do not prove external
provider or live backend state.

Deployment URL/environment and limitations: no Vercel preview or production deployment has been
claimed. `.env.example` defines `NEXT_PUBLIC_HAVENERR_ADMIN_API_BASE_URL` (default
`https://api.havenerr.com`) and `NEXT_PUBLIC_HAVENERR_ADMIN_ORIGIN` (default
`https://controlpanel.havenerr.com`). The generated Next agent instruction files are intentionally
kept in the repository. Live DTOs with `additionalProperties: true` use redacted safe projection
rendering until the backend publishes more field-level shape.

Known failures/rollback: no known repository check failures. A live admin account, exact CORS
allowlist, cookie behavior, invitation token delivery channel, and Vercel project credentials are
required for final integration. Keep rollback local and reversible until those checks pass.

Next agent: read this entry, `docs/PROGRESS.md`, and the backend `CHANGES/API/ADMIN_FRONTEND/` package;
run the local checks; review the current diff; configure a safe backend fixture or test environment;
exercise live CORS/cookies/DTOs and every high-impact flow; add missing contract/accessibility
coverage; deploy a Vercel preview; perform the required smoke tests; then update this file with a new
newest-first entry and promote AF-5 only with evidence.

# Havenerr admin frontend handoff

Entries are newest first. The backend repository is read-only for this project.

## 2026-09-08 - Codex - M24 customer feedback read-only admin projection

Status: local backend/frontend implementation complete; live migration, customer-main-website,
CORS, and deployment proof held.

Pages/components/API modules: the main website submits `POST /v1/feedback`; the admin panel reads
`GET /admin/v1/feedback` and `GET /admin/v1/feedback/{feedback_id}` through the new `/feedback` and
`/feedback/[id]` pages. Backend migration `0037_customer_feedback`, `fbk_` IDs, feedback repository,
service, customer route, admin route, signed cursors, OpenAPI, and API docs are implemented.

Permission/step-up/destructive decisions: customer submission is authenticated, CSRF/idempotency
protected, bounded to 1–5 stars and 2,000 characters, and rate-limited per user. Admin reads use
`analytics.read` and are strictly read-only. The admin projection contains only feedback id,
pseudonymous customer id, stars, message, and creation timestamp. No admin submit/edit/delete or
moderation control exists.

Commands/tests/browser evidence: backend typecheck, lint, 259-file unit suite with 1,415 tests, and
OpenAPI drift check pass; frontend typecheck, lint, format, unit, build, and Playwright desktop/mobile
mock tests (18/18) pass. The frontend mock verifies the feedback list/detail flow and that no admin
write control is rendered. The backend unit coverage includes migration, repository, service, route
permission manifest, and cursor behavior.

Deployment URL/environment and limitations: no production database migration or live customer
submission was run. The main website repository is outside the current frontend repository; it must
call the documented customer route. No Vercel preview or production deployment is claimed.

Known failures/rollback: no local check failures remain. Migration 0037 is forward-only and must be
applied through the normal migration runner after review/backup. Customer feedback messages must not
be copied to analytics or logs.

Next agent: apply migration 0037 in a controlled environment, submit a real customer feedback
request with CSRF/idempotency/rate-limit checks, verify analytics.read role access and signed cursor
admin reads, then run live frontend smoke and deploy the preview.

## 2026-09-08 - Codex - AF-0 through AF-5 local hardening and contract coverage

Status: local implementation and verification complete; AF-5 remains held because live backend,
CORS/cookie, and Vercel evidence is unavailable.

Pages/components/API modules: added real protected `/audit` and `/system` App Router pages; hardened
`lib/admin/client.ts` to require the exact `{ success, data, request_id }` success envelope and keep
stable mutation keys through network, CSRF, and `IDEMPOTENCY_IN_PROGRESS` retries; added documented
query allowlists in `lib/admin/api.ts`; added route-family fixtures in `lib/admin/api.test.ts`;
expanded `components/operational-pages.tsx` with reconciler controls and quarantine approval/clock/
executor evidence; corrected infrastructure filter names and reset behavior; strengthened unknown
projection redaction; added modal focus trapping/return, Escape handling, accessible table regions,
and role-grant/version guards across admin, feature, quota, customer, billing, and infrastructure
actions. Security headers now include no-store, HSTS, COOP/CORP, and cross-domain policy controls.

API routes/permissions/step-up decisions: all browser calls remain under the documented
`/admin/v1` boundary. Query keys now match the documented users, orgs, hosting, deployments,
domains, databases, VPS, billing, audit, jobs, outbox, and quarantine matrices. Reconciler actions
use `system.write`; resource actions use their documented `*.write` permission. High-impact actions
continue to depend on the server's `STEP_UP_REQUIRED` response and replay the original mutation
with the same idempotency key. Missing current versions no longer default to `1`; the UI waits for a
valid version. Catalogue action bodies no longer submit an unsupported reason field. No customer,
worker, provider, PayU, shell, credential, raw payment, environment-value, certificate-key, or
database-password route is called.

Commands/tests/browser evidence: `npm.cmd run typecheck`, `npm.cmd run lint`,
`npm.cmd run format:check`, `npm.cmd test` (20 tests across 7 files), `npm.cmd run build`, and
Playwright desktop/mobile mock tests (16/16) pass. Coverage includes exact envelopes, safe errors,
CSRF/credentials, network and in-progress idempotency retry, session expiry, permission hooks,
route/filter allowlists, encoded action paths, RBAC grant ceilings, projection redaction, modal focus
trap/return, keyboard-scrollable tables, step-up continuation with the same key, real audit/system
routes, and security headers. Local production-server verification returned 200 for `/`, `/login`,
`/audit`, and `/system`; it reported `Cache-Control: no-store`, `X-Frame-Options: DENY`,
`nosniff`, CSP with the documented API connect origin, HSTS, COOP, CORP, and cross-domain policy.

Deployment URL/environment and limitations: no Vercel preview or production URL is claimed.
`vercel` is unavailable, no Vercel environment names/project file are present, and the safe live API
probe could not resolve `api.havenerr.com` from this environment. Therefore live admin login, MFA,
invitation, CORS/cookie, DTO, worker/provider, DNS, Redis, payment, production-clone, and external
reconciliation proof remain held. The local browser suite uses an isolated mock of the public admin
boundary and cannot promote AF-5.

Known failures/rollback: no repository check failures remain. The only generated `next-env.d.ts`
change from the production build was returned to the committed development-generated form; no
backend files were modified. Rollback is local/reversible until a safe backend and deployment are
available.

Follow-up feature request: customer feedback ratings/messages (1–5 stars plus a message) is recorded
as a pending feature only. It was not implemented because this task keeps `D:\API - Havenerr`
read-only and no reviewed backend schema/route/permission contract exists. Do not invent a feedback
endpoint; first obtain the backend contract and an explicit scope change for backend implementation.

Next agent: verify a controlled backend environment and exact CORS/cookie behavior; run the live
login/MFA/invitation/refresh/logout, denied-action, safe-read, step-up, expiry, async, billing, and
quarantine scenarios; configure a Vercel preview with only the two public origin variables; then
update this tracker and handoff with external evidence. Separately, if the feedback feature is still
desired, start by adding the backend contract/schema/permission decision in the backend repository
under an explicitly approved scope before touching frontend routes.

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

# Havenerr admin frontend handoff

Entries are newest first. Backend contract/implementation evidence is maintained in the sibling
repository `D:\API - Havenerr`; this continuation was explicitly approved to update both repositories.

## 2026-09-24 - /root - M26 contract audit follow-up

Aligned the Secret Files UI with the backend's enforced safe-redaction input bounds: create/replace
values require at least four characters per non-empty line and no more than 64 KiB in UTF-8. The
page validates before sending and the contract matrix records the same request rules. Reveal remains
one-time, fresh-MFA gated, and transient in component memory.

Verification on Windows / Node 24.11.1: `npm.cmd run typecheck`, `npm.cmd run lint`,
`npm.cmd run format:check`, `npm.cmd test` (9 files / 34 tests), `npm.cmd run build` with local
`HAVENERR_ADMIN_UPSTREAM_ORIGIN=http://127.0.0.1:5000`, and `npm.cmd run test:e2e` (36 desktop/mobile
Playwright tests) passed. Unit/browser requests use fixtures; this does not claim a live Vercel/API
session or deployment. The pre-existing Dashboard `.env.example` edit is unchanged and excluded.

The sibling backend's fresh-MFA idempotency continuation now uses the same key after the pre-effect
`STEP_UP_REQUIRED` rejection; no Dashboard retry contract change was needed.

## 2026-09-24 - Codex - M26 operator UI completion

The user assigned completion of the remaining operator frontend to this continuation and requested
separate commits/pushes for both repositories when all work is done. Local UI implementation and
verification are complete; no live API session or production deployment was performed. M26 remains
open pending the backend's controlled Linux/PM2/Bubblewrap and secret-isolation rehearsal.

Added the complete Deploy, System Configuration, Secret Files, and Runtime pages. The deploy flow
reviews the exact SHA and reason, confirms explicitly, polls durable progress/history/log offsets,
reconnects without overlapping log pages, requests safe cancellation, and requires typed confirmation
for manual rollback. Config uses the backend editable-key allowlist and supports validate/save/revert.
Secrets support create/replace/delete/revert and fresh-MFA reveal; the revealed value stays in local
component state, clears after 30 seconds or page hide, and is not put in TanStack Query, localStorage,
or sessionStorage. Restart polls readiness and reconnects. API request/response types and request
factories match the registered backend route patterns; all mutations use the existing
`useAdminSession().runMutation` idempotency/step-up flow. Contract matrix and unit/e2e coverage were
updated. Next 16 production build generated the `next-env.d.ts` route type reference update.

Changed task files: `app/(console)/deploy/page.tsx`, `app/(console)/system/{config,secrets,runtime}/page.tsx`,
`app/globals.css`, `components/auth/session-context.tsx`, `components/deployment-pages.tsx`,
`components/deployment-pages.test.tsx`, `lib/admin/{api.ts,api.test.ts,types.ts,navigation.ts}`,
`e2e/admin-console.spec.ts`, `docs/ADMIN_API_CONTRACT_MATRIX.md`, `docs/PROGRESS.md`, and this
handoff. The unrelated pre-existing `.env.example` edit was preserved and will not be included in
the task commit.

Verification on Windows / Node 24.11.1, 2026-09-24:

- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run format:check` — passed.
- `npm.cmd run build` with `HAVENERR_ADMIN_UPSTREAM_ORIGIN=http://127.0.0.1:5000` — passed; routes
  `/deploy`, `/system/config`, `/system/runtime`, and `/system/secrets` were generated.
- `npm.cmd test` — 9 files / 33 tests passed.
- `npm.cmd run test:e2e` — 36 desktop/mobile Playwright tests passed, including operation reconnect,
  manual rollback, config validation/save, transient reveal, and restart/readiness reconnect.

The build uses a local loopback proxy origin only. Browser tests use mocks, and no real Admin
credentials, Vercel preview, production API, or Linux host was available. Backend-specific runbook,
worker tests, and exact live gate status are recorded in `D:\API - Havenerr\HANDOFF.md`.

The implementation commit `f8d77a2` was pushed to `origin/feat/admin-control-panel-integration`;
the sibling backend implementation commit `d4556ff` was pushed to the same-named branch in its
repository. The pre-existing `.env.example` edit remains unstaged.

## 2026-09-24 - Codex - dedicated Admin plane reconciliation

Status: frontend implementation and local verification complete and accepted for backend
integration. The coordinator handles the requested final commit and push. No deployment, live API
session, Vercel preview, or production proof is claimed. No backend files were edited from this
frontend task.

Scope and changed files: updated the same-origin `/admin/v1` rewrite and server-only upstream
configuration (`next.config.ts`, `.env.example`, `lib/admin/upstream.ts`); reconciled the API client,
error handling, server-provided permission/grant types, resource clients, and contract tests under
`lib/admin/**`; updated auth/session, shell, billing, operations, database, feedback, quota, feature,
catalogue, organization, user, and administrator UI; added Quick Database and custom-tier/assignment
pages; removed Hosting, Deployments, Domains, VPS/HavenVPS routes and legacy components; added the
upstream rewrite fixture and desktop/mobile coverage under `e2e/**`; updated `README.md`,
`docs/DEPLOYMENT.md`, `docs/ADMIN_API_CONTRACT_MATRIX.md`, and `docs/PROGRESS.md`.

Contract and safety decisions: all browser API calls stay on the Control Panel origin and use
credentialed cookies. Mutations carry the readable CSRF token and a stable idempotency key; manual
retries after uncertain transport outcomes reuse the same key. Money-moving payment corrections use
`POST /billing/payments/{id}:correct`, classified correction reasons, fresh step-up, and no automatic
transport resend. Refund history is read-only; subscription cancellation is period-end only. Plan
prices live in one immutable `plans` revision with add-ons and use `pcv_...` IDs for detail/diff/
actions; founder price is read-only, future purchases use the new prices, and purchase-time invoice
and subscription-item snapshots stay fixed. Custom-tier prices are presentation-only and all grants
are no-charge. Feature visibility and grant UX consume `/auth/me.permissions` and
`/auth/me.assignable_roles`. The System page queues only databases, Quick Databases, and billing
reconcilers with strict empty-object bodies. Active plan schemas/catalogues no longer contain retired
`hosting.*` limits; historical SQL entitlement/history rows may remain but are ignored by active
code. The project member permission editor is outside this Admin UI and uses the separate customer
Control plane contract `{read,create,update,delete,invite,reveal_credentials}` with no `deploy` grant.

Verification commands and results:

- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run format:check` — passed.
- `npm.cmd test` — passed: 8 files, 27 tests.
- `$env:HAVENERR_ADMIN_UPSTREAM_ORIGIN = 'https://api.havenerr.com'; npm.cmd run build` — passed;
  Next generated only supported routes.
- `npm.cmd run test:e2e` — passed: 26 tests across Chromium desktop and mobile.
- `git diff --check` — passed; Git reported only LF-to-CRLF normalization notices.

The Playwright dashboard desktop and mobile navigation screenshots were saved under ignored
`test-results/` and visually inspected. The Next.js dev-tools badge in local captures is development
tooling; it is absent from the production build policy. The development CSP allows React's eval
instrumentation only in development; production `script-src` remains without `unsafe-eval`.

Failures corrected during verification: local `.next/dev/types/validator.ts` initially retained
deleted route references, and the first build/typecheck failed on those stale generated types. The
Next dev server regenerated its route types; subsequent typecheck and production build passed. The
first Vitest run exposed an omitted query limit in an assertion and fake-timer ordering around the
Web Crypto key fingerprint; both tests were corrected. Initial Playwright retries exposed an
ambiguous label selector and missing mobile sign-out access; selectors are scoped and the mobile
navigation now includes Sign out. Final verification above is green.

Next operational step: deploy the backend and Control Panel to a controlled preview with the
documented origins, cookie/CORS settings, TLS and proxy behavior; then exercise real admin login,
MFA, read flows, price-revision publication, billing checkout, and logout before production cutover.
The backend intentionally records/rate-limits the immediate trusted proxy peer; with Vercel external
rewrites this means Admin request IP metadata is the Vercel-to-API peer unless authenticated client-IP
forwarding is added. Verify aggregate IP limits and decide whether per-browser IP attribution is
required before production. This repository has only local mock-upstream browser proof and makes no
live API or production claim.

## 2026-09-08 - Codex - private admin-origin configuration

The frontend no longer declares or reads `NEXT_PUBLIC_HAVENERR_ADMIN_ORIGIN`. Because the
administrator page is a Client Component, renaming that variable to a private server-only env name
would make it unavailable in the browser. Invitation URLs now derive their origin from
`window.location.origin`, with the `.info` hostname as the server-render fallback. The public API
base variable remains intentionally public because browser requests must know the API origin.

## 2026-09-08 - Codex - M24 continuation verification and read-only feedback hardening

Status: local frontend/backend feature work complete; live backend/API/CORS/cookie, Redis,
customer-main-website, Vercel, and production proof held.

Pages/components/API modules: `/feedback` and `/feedback/[id]` consume only the sanitized admin
feedback list/detail routes. The list now exposes sort order, preserves opaque signed cursors, and
resets them after filter/sort changes. The backend cursor SQL regression was fixed and
`PLATFORM_ADMIN` was added to the `analytics.read` boundary through typed RBAC and migration 0038.

Permission/step-up/destructive decisions: feedback remains strictly read-only in the dashboard;
there is no submit, edit, delete, moderation, approval, or overwrite action. Only `ROOT`,
`PLATFORM_ADMIN`, and `ANALYST` can inspect the projection; no customer credential, session,
payment, provider, environment, or MFA/recovery data is rendered.

Commands/tests/browser evidence: frontend typecheck, lint, format, 20 Vitest tests, production
build, and 20 desktop/mobile Playwright tests pass. The new browser checks cover escaped long
messages, `overflow-wrap:anywhere` and no nested script element, narrow mobile layout, keyboard
focus visibility, page-2 cursor requests, and cursor reset with changed rating/sort/order. Backend
typecheck/lint/build, 261-file/1,420-test suite, OpenAPI 226/213/13 checks, and SDK regeneration
also pass.

Deployment URL/environment and limitations: no deployment was performed. Loopback MySQL accepted
migration 0037 through the normal runner and a rolled-back real repository cursor continuation;
Redis is unavailable, so live customer/admin HTTP sessions, fail-closed rate-limit, CORS/cookie,
main-website, provider, Vercel, and production proof are not claimed. Migration 0038 remains
unapplied in the 0037-only local database check.

Known failures/rollback: no local checks remain failing. The frontend changes are reversible local
edits; backend migrations are forward-only and must be run through the normal migration runner.

Next agent: execute the authenticated customer/admin HTTP matrix with Redis in a controlled backend
environment, then run the frontend live smoke. Do not deploy from this handoff.

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

## 2026-09-28 M26 systemd operations — live Admin pages verified

Dashboard commit 096a5e6 is on origin/main and the production Vercel panel includes the updated
systemd status/restart experience. Using the existing authenticated Admin session, live Deploy,
Configuration, Secret Files, and Runtime pages all loaded. Runtime showed the backend service
active/enabled, readiness ready, and matching active/served commit 8a49cc8. Deploy showed the
operations worker active and the current main release up to date; Configuration loaded the saved
revision; Secret Files listed metadata with all values hidden. Unauthenticated operational API
requests returned 401, preserving the backend Admin authorization boundary.

Local verification: typecheck, lint, build, 37 unit tests, 34 targeted desktop/mobile Playwright
checks, and changed-file Prettier checks passed. No config/secret mutation, reveal, or live deploy
action was submitted. The Admin deployment history is empty because this release was transferred
and activated through the reviewed VPS release procedure rather than initiated by an Admin UI
operation. See the sibling API repository for backend and host evidence. M26 remains partial until
the live Admin-triggered deployment and remaining security rehearsals pass.

## 2026-09-27 Admin MFA enrollment UI — implemented and verified

The enrollment page now builds a real QR from the backend `otpauth_uri` in the browser, displays it
beside clear setup steps, and keeps manual secret/URI entry as a fallback. The MFA panel gets a wider
desktop layout and stacks at narrower widths. First-login enrollment still uses the backend's
restricted-session route contract; no backend code or API repository files changed.

Verification: typecheck, lint, build, unit tests (10 files / 36 tests), the existing desktop and
mobile Playwright suite (36 tests), and the new MFA first-login flow in desktop/mobile Playwright
(2 tests) passed. Changed-file Prettier checks passed. The repository-wide format check flags the
unchanged `docs/ADMIN_API_CONTRACT_MATRIX.md`, which is already unformatted at HEAD. Playwright
screenshots were inspected at both viewport sizes. Upstream calls use fixtures; no live MFA
enrollment or production/API session was claimed. Claim released.

# Havenerr Admin Control Panel progress

## 2026-09-24 M26 operator controls — local implementation complete; host gate open

The user assigned the remaining operator Dashboard work to this continuation. The Deploy, System
Configuration, Secret Files, and Runtime pages now use typed APIs over the existing same-origin
`/admin/v1` proxy and `useAdminSession().runMutation` flow. Deployment includes exact-SHA review,
confirmation, progress, history, incremental logs, reconnect, cancellation, and typed manual
rollback. Config includes allowlisted edits, validation, save/revert, and restart-required status.
Secrets include create/replace/delete/revert, client validation for the backend four-character-per-line/64-KiB rule, plus a fresh-MFA transient reveal held only in component
state; it clears after 30 seconds or when the page becomes hidden. Runtime restart reconnects and
reports readiness. Updated the Admin API contract matrix and added unit/browser coverage. Next 16
generated the current route-type reference in `next-env.d.ts` during production build.

Verification on Windows, 2026-09-24: `npm.cmd run typecheck`, `npm.cmd run lint`,
`npm.cmd run format:check`, `npm.cmd run build` with
`HAVENERR_ADMIN_UPSTREAM_ORIGIN=http://127.0.0.1:5000`, `npm.cmd test` (9 files / 34 tests), and
`npm.cmd run test:e2e` (36 desktop/mobile tests) passed. Browser tests use local mock fixtures. No
live Admin session, deployed Dashboard, Vercel preview, or controlled Linux worker/PM2 rehearsal was
available. M26 remains open until the sibling backend's controlled-host and secret-isolation gates
pass. The pre-existing `.env.example` edit was preserved and is excluded from the task commit.

## Released claim — 2026-09-24

Owner: `/root/frontend` (released after frontend work and cross-repository contract review). The
coordinator owns the final commit/push; backend files remain in `D:\API - Havenerr`.

The supported operator UI is `https://controlpanel.havenerr.info`. Browser calls stay on same-origin
`/admin/v1/*`, rewritten by Next.js to `https://api.havenerr.com/admin/v1/*`. The backend is the
authority for authorization, current user permissions, assignable roles, validation, audit, and
state transitions.

## Current implementation

| Area                             | Status      | Evidence                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and session       | Implemented | Login, MFA setup/confirmation, invitation acceptance, session inventory/revocation, password rotation, cookie/CSRF client, error/request-ID handling, and stable idempotency for user retries.                                                                                                                                      |
| Supported data and control pages | Implemented | Users, organizations, plans/add-ons, quotas, identity flags, project databases, Quick Databases, custom tiers/assignments, billing, feedback, audit, health, jobs, outbox, and quarantine.                                                                                                                                          |
| Billing safety                   | Implemented | Immutable `plans` revision includes add-ons; prices use minor units; founder price is read-only; corrections use `:correct`; refund history is read-only; subscription cancellation is period-end only.                                                                                                                             |
| Unsupported product surfaces     | Removed     | Hosting, Deployments, Domains, VPS/HavenVPS, worker controls, shell/terminal, hidden agents, dedicated compute, and private-provider admin surfaces are absent from page routes/navigation/API calls. Current plan snapshots omit retired keys; historical SQL entitlement/history remains preserved but is ignored by active code. |
| Contract and browser coverage    | Implemented | `docs/ADMIN_API_CONTRACT_MATRIX.md`, route/body tests, safe-envelope/client tests, desktop/mobile Playwright mocks, upstream rewrite fixture, cookie/CSRF/logout checks, correction retry, step-up continuation, and custom-tier assignment.                                                                                        |

## Verification record

Final local verification after the UI, contract matrix, and documentation edits:

- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run format:check` — passed.
- `npm.cmd test` — passed, 8 files and 27 tests.
- `npm.cmd run build` — passed with `HAVENERR_ADMIN_UPSTREAM_ORIGIN=https://api.havenerr.com`.
- `npm.cmd run test:e2e` — passed, 26 desktop/mobile tests.
- `git diff --check` — passed; Git emitted only line-ending normalization notices.

Desktop and mobile screenshots from Playwright are under ignored `test-results/` and were inspected.
The local dev overlay shown in those captures is development tooling; no production UI or deployment
claim is based on it.

No frontend deployment, live API session, Vercel preview, or production proof is claimed. Commit and
push remain held until `/root` sends final integration clearance.

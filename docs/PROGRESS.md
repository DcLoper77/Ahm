# Havenerr Admin Control Panel progress

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

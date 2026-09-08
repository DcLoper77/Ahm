# Havenerr admin frontend progress

Evidence snapshot: 2026-09-08. This repository is the separate Vercel frontend for
`https://controlpanel.havenerr.com`. The backend contract remains the authoritative
`https://api.havenerr.com/admin/v1` surface documented in the sibling API repository.

| Milestone                            | Status                       | Evidence                                                                                                                                                                            | Next gate                                                                                     |
| ------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| AF-0 shell/API client/session gate   | RELEASED                     | Strict TypeScript, ESLint, Prettier, Vitest, production build, credentialed client, CSRF retry, stable idempotency, login/me/refresh/logout/session-expiry flow                     | Exercise against a safe backend environment and verify CORS/cookie behavior                   |
| AF-1 invitations/MFA/RBAC/navigation | UI RELEASED; live proof held | Invitation acceptance, MFA enrollment/recovery screens, session list/revocation, exact six-role matrix, capability-derived navigation, step-up continuation flow                    | Exercise invitation/MFA/step-up with real admin accounts; confirm current role payloads       |
| AF-2 users/orgs/catalogue/quotas     | UI RELEASED; live proof held | Cursor tables, filters/sorts, detail pages, guarded suspend/restore, typed catalogue drafts/actions/diff, features, quota overrides                                                 | Validate every DTO shape and optimistic conflict against the live admin API                   |
| AF-3 hosting/domains/databases/VPS   | UI RELEASED; live proof held | Safe projection tables/details, desired/observed state, deployment rollback/reconcile, domain/database/VPS actions and warnings                                                     | Verify async operation/job/outbox convergence and provider-degraded states                    |
| AF-4 billing/analytics/audit/system  | UI RELEASED; live proof held | Billing lists/details/refund/cancel/reconcile, usage/health/audit/worker/job/outbox/quarantine views                                                                                | Run money-moving and two-person quarantine scenarios in a controlled environment              |
| AF-5 hardening/deploy                | NOT RELEASED                 | Local hardening patch: exact-envelope/error/retry/RBAC/redaction tests, 20 Vitest tests, 16 Playwright desktop/mobile mock tests, production build, no-store/security-header checks | Configure Vercel preview/production, run live smoke, accessibility scan, PII redaction review |

The phrases “UI RELEASED” and “RELEASED” describe repository evidence only. No external worker,
DNS, provider, Redis, production-clone, or production API proof is claimed by this tracker.

Follow-up feature request (not started): customer feedback ratings/messages (1–5 stars plus a
message) requires an approved backend schema, route, permissions, and persistence contract before
the admin page can be added. The backend repository remains read-only for this frontend task.

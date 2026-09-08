You are the next implementation agent for the Havenerr administrative control-panel frontend.

Work only in `D:\Dashboard - Haven-Admin`. Treat `D:\API - Havenerr` as read-only. Start by reading
`docs/PROGRESS.md`, `docs/HANDOFF.md`, the current Git diff/log, and the nine authoritative backend
documents named in the original task. Continue from the committed baseline; do not scaffold a second
app or replace the existing API client.

The current repository already contains the Next.js 16 TypeScript App Router shell, strict tooling,
the credentialed `lib/admin/client.ts` boundary, exact six-role RBAC, session/login/MFA/invitation
flows, responsive light UI, resource pages for the documented admin route families, focused Vitest
tests, and Playwright desktop/mobile smoke tests. The latest local hardening pass adds exact-envelope
and documented-route fixtures, redaction/error catalogue coverage, real `/audit` and `/system`
routes, reconciler/quarantine evidence, version guards, keyboard modal/table behavior, and security
header checks. `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run format:check`,
`npm.cmd test` (20 tests), and `npm.cmd run build` pass; the isolated Playwright suite passes 16/16.
Those tests use mocks and do not prove live CORS, cookies, DTOs, worker/provider state, or Vercel
behavior.

Complete the held work in this order:

1. Inspect and improve the existing implementation without changing the documented backend boundary.
2. Add meaningful contract fixtures/tests for every documented admin route family and exact response
   envelope; keep unknown projections redacted and never invent fields or convenience routes.
3. Exercise invitation acceptance, MFA enrollment/confirmation/recovery rotation, refresh/logout,
   permission denial, step-up continuation with the same idempotency key, version conflicts, async
   operations, refund/cancel/destructive confirmations, and quarantine two-person states against a
   safe backend environment.
4. Run responsive visual QA and accessibility checks at desktop, tablet, and narrow mobile widths.
   Verify keyboard navigation, reduced motion, focus trapping/return, no-store behavior, CSP/security
   headers, and absence of secrets/PII in logs, URLs, telemetry, storage, or screenshots.
5. Configure and deploy a Vercel preview using only public API origin variables; verify the production
   API origin and exact control-panel origin. Do not place credentials or tokens in client variables.
6. Update `docs/PROGRESS.md` and prepend a detailed entry to `docs/HANDOFF.md` with evidence, limits,
   deployment details, and the exact next action. Commit small coherent changes and leave the tree
   clean.

Do not claim external worker, DNS, provider, Redis, production-clone, or production proof until a
real controlled check demonstrates it.

Pending follow-up request: customer feedback ratings/messages (1–5 stars plus a message) is not
implemented yet. Because the current scope keeps `D:\API - Havenerr` read-only, first obtain an
approved backend schema/route/permission/persistence contract and explicit backend scope before
adding the admin frontend page; never guess the endpoint.

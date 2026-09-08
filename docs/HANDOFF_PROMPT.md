# Havenerr feedback feature continuation prompt

You are the continuation implementation agent for the Havenerr customer-feedback feature and the
Havenerr administrative control-panel frontend.

The user has approved editing both repositories. Work only in these two repositories:

- Backend: `D:\API - Havenerr`
- Admin frontend: `D:\Dashboard - Haven-Admin`

Do not deploy anything in this continuation. Test locally, complete the implementation, update all
relevant documentation, commit both repositories, and push both `main` branches when the local
verification is green.

Product boundary

Customers submit feedback through the main website/customer control-plane API. The admin dashboard
is strictly read-only for feedback. Do not add admin create, edit, delete, moderation, approval, or
overwrite controls.

The implemented contract is:

```text
POST /v1/feedback
  body: { stars: integer 1..5, message: trimmed string 1..2000 }
  authenticated customer session/PAT boundary
  CSRF for cookie sessions
  Idempotency-Key required by the control-plane mutation middleware
  per-user fail-closed feedback rate limit

GET /admin/v1/feedback
  analytics.read
  cursor, limit, stars, user_id, from, to, sort_by, sort_order

GET /admin/v1/feedback/{feedback_id}
  analytics.read
  sanitized read-only projection
```

The admin projection contains only `id`, `user_id`, `stars`, `message`, and `created_at`. Do not
return or log passwords, session tokens, customer credentials, MFA/recovery data, payment payloads,
provider values, environment values, or other secret material.

Required reading before edits

Read these backend contract and architecture documents completely:

1. `D:\API - Havenerr\CHANGES\API\ADMIN_API.md`
2. `D:\API - Havenerr\CHANGES\API\SCHEMA_INDEX.md`
3. `D:\API - Havenerr\CHANGES\API\ROUTE_INVENTORY.md`
4. `D:\API - Havenerr\CHANGES\API\ADMIN_FRONTEND\README.md`
5. `D:\API - Havenerr\CHANGES\API\ADMIN_FRONTEND\ARCHITECTURE.md`
6. `D:\API - Havenerr\CHANGES\API\ADMIN_FRONTEND\MILESTONE.md`
7. `D:\API - Havenerr\CHANGES\API\ADMIN_FRONTEND\PROGRESS.md`
8. `D:\API - Havenerr\CHANGES\API\ADMIN_FRONTEND\HANDOFF.md`
9. `D:\API - Havenerr\Docs\openapi.yaml`
10. `D:\API - Havenerr\Docs\RESOURCE_MODEL.md`
11. `D:\API - Havenerr\Docs\SECURITY.md`
12. `D:\API - Havenerr\Docs\RUNTIME.md`
13. `D:\API - Havenerr\Docs\sdk\README.md`
14. `D:\API - Havenerr\Docs\sdk\types.ts`
15. `D:\API - Havenerr\src\data\migrations\README.md`

Read these frontend documents and current implementation files:

1. `D:\Dashboard - Haven-Admin\docs\PROGRESS.md`
2. `D:\Dashboard - Haven-Admin\docs\HANDOFF.md`
3. `D:\Dashboard - Haven-Admin\docs\HANDOFF_PROMPT.md`
4. `D:\Dashboard - Haven-Admin\README.md`
5. `D:\Dashboard - Haven-Admin\package.json`
6. `D:\Dashboard - Haven-Admin\lib\admin\client.ts`
7. `D:\Dashboard - Haven-Admin\lib\admin\api.ts`
8. `D:\Dashboard - Haven-Admin\lib\admin\types.ts`
9. `D:\Dashboard - Haven-Admin\lib\admin\rbac.ts`
10. `D:\Dashboard - Haven-Admin\lib\admin\navigation.ts`
11. `D:\Dashboard - Haven-Admin\components\auth\session-context.tsx`
12. `D:\Dashboard - Haven-Admin\components\console\app-shell.tsx`
13. `D:\Dashboard - Haven-Admin\components\feedback-pages.tsx`
14. `D:\Dashboard - Haven-Admin\app\(console)\feedback\page.tsx`
15. `D:\Dashboard - Haven-Admin\app\(console)\feedback\[id]\page.tsx`
16. `D:\Dashboard - Haven-Admin\e2e\admin-console.spec.ts`

Backend reference files changed for this feature

- `src/data/migrations/0037_customer_feedback.ts`
- `src/data/migrations/0037_customer_feedback.test.ts`
- `src/data/migrations/index.ts`
- `src/data/repositories/feedback.ts`
- `src/data/repositories/feedback.test.ts`
- `src/services/feedback/service.ts`
- `src/services/feedback/service.test.ts`
- `src/http/planes/control/routes/feedback.ts`
- `src/http/planes/control/index.ts`
- `src/http/planes/admin/feedback.ts`
- `src/http/planes/admin/index.ts`
- `src/http/planes/admin/permissions.ts`
- `src/http/planes/admin/permissions.test.ts`
- `src/platform/ids.ts`
- `src/platform/rateLimiter.ts`
- `src/services/identity/testSupport.ts`
- `scripts/openapi/generate.mts`
- `Docs/openapi.yaml`
- `Docs/sdk/types.ts`

Frontend reference files changed for this feature

- `lib/admin/api.ts`
- `lib/admin/types.ts`
- `lib/admin/navigation.ts`
- `components/feedback-pages.tsx`
- `components/icons.tsx`
- `app/(console)/feedback/page.tsx`
- `app/(console)/feedback/[id]/page.tsx`
- `app/globals.css`
- `e2e/admin-console.spec.ts`

Remaining work

1. Inspect the complete backend and frontend diffs. Do not reset or discard existing uncommitted
   feedback work.
2. Run backend:

   ```powershell
   cd D:\API - Havenerr
   npm.cmd run typecheck
   npm.cmd run lint
   npm.cmd run build
   npm.cmd test
   npm.cmd run openapi:generate
   npm.cmd run openapi:check
   npx.cmd openapi-typescript Docs/openapi.yaml -o Docs/sdk/types.ts
   ```

3. Run frontend:

   ```powershell
   cd D:\Dashboard - Haven-Admin
   npm.cmd run typecheck
   npm.cmd run lint
   npm.cmd run format:check
   npm.cmd test
   npm.cmd run build
   npm.cmd run test:e2e
   ```

4. If a safe local backend environment is available, apply migration 0037 only through the normal
   migration runner and verify:

   - customer submission with valid/invalid stars and message lengths;
   - CSRF rejection and idempotency replay/reuse;
   - per-user rate-limit behavior;
   - customer feedback persistence;
   - ANALYST/PLATFORM_ADMIN/ROOT admin reads;
   - denial for roles without `analytics.read`;
   - signed cursor continuation and filter/sort mismatch rejection;
   - detail lookup and not-found behavior;
   - sanitized projection and absence of secrets/payment/provider values.

5. Run the frontend browser suite locally. Verify the feedback page is read-only, has no submit or
   moderation action, renders long messages safely, remains usable on narrow mobile/tablet widths,
   has visible focus states, and resets cursors whenever filters or sorting change.
6. Do not deploy. Do not claim live production proof. Do not add a customer-facing main-website UI
   in the admin repository.
7. Update these documentation files with exact local evidence and remaining limitations:

   - backend `CHANGES/API/ADMIN_API.md`
   - backend `CHANGES/API/HAVENERR_API.md`
   - backend `CHANGES/API/ROUTE_INVENTORY.md`
   - backend `CHANGES/API/SCHEMA_INDEX.md`
   - backend `CHANGES/API/ADMIN_FRONTEND/ARCHITECTURE.md`
   - backend `CHANGES/API/ADMIN_FRONTEND/PROGRESS.md`
   - backend `CHANGES/API/ADMIN_FRONTEND/HANDOFF.md`
   - backend `Docs/RESOURCE_MODEL.md`
   - backend `Docs/sdk/README.md`
   - backend root `HANDOFF.md` if needed for the newest backend entry
   - frontend `docs/PROGRESS.md`
   - frontend `docs/HANDOFF.md`
   - frontend `docs/HANDOFF_PROMPT.md`

8. Keep the root bootstrap credentials out of commits and documentation. The approved local files
   are `D:\API - Havenerr\config\dev-secrets\admin-root-email` and
   `D:\API - Havenerr\config\dev-secrets\admin-root-password`; never print or commit their
   contents except when the user explicitly requests the credential directly.
9. Commit coherent changes separately in both repositories, inspect the staged diffs, verify clean
   working trees, and push both `main` branches:

   ```text
   Backend:  feat: add customer feedback persistence and admin projection
   Frontend: feat: add read-only customer feedback admin views
   ```

Do not deploy. Completion means local implementation, tests, documentation, commits, and pushes are
complete and accurately reported.

## Continuation execution record — 2026-09-08

The continuation audit found and fixed a default-list feedback cursor SQL defect: page two now
builds a valid keyset predicate when no filters are present. The admin list also exposes sort order
and resets the opaque cursor when filters or sorting change. Browser coverage now verifies the
strictly read-only surface, escaped messages at the 2,000-character bound, narrow-width wrapping, keyboard
focus visibility, and signed-cursor reset behavior on desktop and mobile.

The backend typed permission catalogue and migration 0038 grant `analytics.read` to
`PLATFORM_ADMIN`, matching the required `ROOT`/`PLATFORM_ADMIN`/`ANALYST` feedback-read boundary.
Migration 0037 was applied only through the normal runner to the loopback development MySQL database;
migration 0038 was not applied during that 0037-only check. Redis is unavailable locally, so the
remaining live customer/session/rate-limit/CORS/API proof is explicitly held. No deployment or
production proof is claimed.

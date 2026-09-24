import { AdminApiClient, type ApiResult } from "./client";
import type { AdminAcceptInvitationBody, AdminInvitationBody, AdminLoginBody } from "./bodies";
import type {
  ActiveProductCatalogue,
  AddonDraftItem,
  AdminInvitationResult,
  AdminInvitationSummary,
  AdminListQuery,
  AdminLoginResult,
  AdminMe,
  AdminRecord,
  AdminSessionResult,
  AdminSessionSummary,
  AdminUserSummary,
  CatalogueActionResult,
  CatalogueRevision,
  CustomerFeedbackSummary,
  CustomerUserDetail,
  CustomerUserSummary,
  CustomTierDraftBody,
  CustomTierSummary,
  OrganizationDetail,
  OrganizationSummary,
  PlanDraftItem,
  TierAssignmentBody,
  TierAssignmentSummary,
  TierRevision,
  DeploymentOperation,
  DeploymentPreview,
  DeploymentLogLine,
  RuntimeStatus,
  RuntimeConfigView,
  SecretSummary,
  MutationInput,
  DeploymentRequestBody,
  DeploymentRollbackBody,
  DeploymentCancelBody,
  ConfigValidateBody,
  ConfigSaveBody,
  ConfigRevertBody,
  SecretCreateBody,
  SecretReplaceBody,
  SecretReasonBody,
} from "./types";
import { encodeSegment } from "./client";

export interface ProductCatalogueDraft {
  plans: PlanDraftItem[];
  addons: AddonDraftItem[];
}

export interface AdminAuthApi {
  login(body: AdminLoginBody): Promise<ApiResult<AdminLoginResult>>;
  me(): Promise<ApiResult<AdminMe>>;
  refresh(): Promise<ApiResult<AdminSessionResult>>;
  logout(): Promise<ApiResult<{ logged_out: true }>>;
  sessions(): Promise<ApiResult<{ sessions: AdminSessionSummary[] }>>;
  revokeSession(sessionId: string, idempotencyKey?: string): Promise<ApiResult<{ revoked: true }>>;
  revokeAll(idempotencyKey?: string): Promise<ApiResult<{ revoked: number }>>;
  enrollMfa(idempotencyKey?: string): Promise<ApiResult<{ secret: string; otpauth_uri: string }>>;
  confirmMfa(
    code: string,
    idempotencyKey?: string,
  ): Promise<ApiResult<{ recovery_codes: string[] }>>;
  rotateRecoveryCodes(
    code: string,
    idempotencyKey?: string,
  ): Promise<ApiResult<{ recovery_codes: string[] }>>;
  rotatePassword(
    body: { current_password: string; new_password: string },
    idempotencyKey?: string,
  ): Promise<ApiResult<{ rotated: true }>>;
  acceptInvitation(
    token: string,
    body: AdminAcceptInvitationBody,
    idempotencyKey?: string,
  ): Promise<ApiResult<AdminLoginResult>>;
}

export interface AdminResourceApi {
  operations: {
    status(): Promise<ApiResult<RuntimeStatus>>;
    runtime(): Promise<ApiResult<RuntimeStatus>>;
    remote(): Promise<ApiResult<DeploymentPreview>>;
    history(): Promise<ApiResult<{ deployments: DeploymentOperation[] }>>;
    detail(id: string): Promise<ApiResult<DeploymentOperation>>;
    logs(
      id: string,
      after: number,
    ): Promise<ApiResult<{ lines: DeploymentLogLine[]; next_offset: number }>>;
    config(): Promise<ApiResult<RuntimeConfigView>>;
    secrets(): Promise<ApiResult<{ secrets: SecretSummary[] }>>;
  };
  admins: {
    list(): Promise<ApiResult<{ admins: AdminUserSummary[] }>>;
    invite(
      body: AdminInvitationBody,
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminInvitationResult>>;
    patch(
      adminId: string,
      body: AdminRecord,
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
    disable(
      adminId: string,
      expected_version: number,
      idempotencyKey?: string,
    ): Promise<ApiResult<{ disabled: true }>>;
  };
  invitations: {
    list(): Promise<ApiResult<{ invitations: AdminInvitationSummary[] }>>;
    revoke(invitationId: string, idempotencyKey?: string): Promise<ApiResult<AdminRecord>>;
  };
  users: {
    list(
      query?: AdminListQuery,
    ): Promise<ApiResult<{ users: CustomerUserSummary[]; next_cursor: string | null }>>;
    detail(userId: string): Promise<ApiResult<CustomerUserDetail>>;
    action(
      userId: string,
      action: "suspend" | "restore",
      body: { reason: string; expected_version: number },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
    tierAssignments(userId: string): Promise<ApiResult<{ assignments: TierAssignmentSummary[] }>>;
    assignTier(
      userId: string,
      body: TierAssignmentBody,
      idempotencyKey?: string,
    ): Promise<ApiResult<{ assignment: TierAssignmentSummary; tier: TierRevision }>>;
    revokeTierAssignment(
      userId: string,
      assignmentId: string,
      body: { reason: string; expected_version: number },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
  organizations: {
    list(
      query?: AdminListQuery,
    ): Promise<ApiResult<{ orgs: OrganizationSummary[]; next_cursor: string | null }>>;
    detail(orgId: string): Promise<ApiResult<OrganizationDetail>>;
    action(
      orgId: string,
      action: "suspend" | "restore",
      body: { reason: string; expected_version: number },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
  catalogue: {
    revisions(): Promise<
      ApiResult<{
        kind: "plans";
        revisions: CatalogueRevision[];
        active_catalogue: ActiveProductCatalogue;
      }>
    >;
    revision(
      revisionId: string,
    ): Promise<
      ApiResult<{ kind: "plans"; revision: CatalogueRevision; definition: ProductCatalogueDraft }>
    >;
    createDraft(
      body: ProductCatalogueDraft,
      idempotencyKey?: string,
    ): Promise<ApiResult<{ revision: CatalogueRevision }>>;
    diff(revisionId: string): Promise<ApiResult<AdminRecord>>;
    action(
      revisionId: string,
      action: "validate" | "publish" | "retire",
      body: { expected_version: number },
      idempotencyKey?: string,
    ): Promise<ApiResult<CatalogueActionResult>>;
    features(): Promise<ApiResult<AdminRecord>>;
    setFeature(
      key: string,
      body: { enabled: boolean; expected_version: number; reason: string },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
  quotas: {
    get(orgId: string): Promise<ApiResult<AdminRecord>>;
    set(orgId: string, body: AdminRecord, idempotencyKey?: string): Promise<ApiResult<AdminRecord>>;
    clear(
      orgId: string,
      keyName: string,
      expected_version: number,
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
  databases: {
    list(
      query?: AdminListQuery,
    ): Promise<ApiResult<{ databases: AdminRecord[]; next_cursor: string | null }>>;
    detail(databaseId: string): Promise<ApiResult<AdminRecord>>;
    action(
      databaseId: string,
      action: "suspend" | "resume",
      body: { expected_version: number; reason?: string },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
  quickDatabases: {
    list(query?: AdminListQuery): Promise<
      ApiResult<{
        quick_databases: AdminRecord[];
        quota: AdminRecord | null;
        next_cursor: string | null;
      }>
    >;
    detail(quickDatabaseId: string): Promise<ApiResult<{ quick_database: AdminRecord }>>;
  };
  tiers: {
    list(): Promise<ApiResult<{ tiers: CustomTierSummary[]; next_cursor: string | null }>>;
    detail(tierId: string): Promise<
      ApiResult<{
        tier: CustomTierSummary;
        revisions?: TierRevision[];
        assignments: TierAssignmentSummary[];
      }>
    >;
    create(
      body: CustomTierDraftBody & { key: string },
      idempotencyKey?: string,
    ): Promise<ApiResult<{ tier: CustomTierSummary }>>;
    patch(
      tierId: string,
      body: CustomTierDraftBody & { expected_version: number },
      idempotencyKey?: string,
    ): Promise<ApiResult<{ tier: CustomTierSummary }>>;
    action(
      tierId: string,
      action: "validate" | "publish" | "archive",
      body: { expected_version: number; reason?: string },
      idempotencyKey?: string,
    ): Promise<ApiResult<{ tier: CustomTierSummary }>>;
  };
  billing: {
    subscriptions(
      query?: AdminListQuery,
    ): Promise<ApiResult<{ subscriptions: AdminRecord[]; next_cursor: string | null }>>;
    subscription(id: string): Promise<ApiResult<AdminRecord>>;
    invoices(
      query?: AdminListQuery,
    ): Promise<ApiResult<{ invoices: AdminRecord[]; next_cursor: string | null }>>;
    invoice(id: string): Promise<ApiResult<AdminRecord>>;
    payments(
      query?: AdminListQuery,
    ): Promise<ApiResult<{ payments: AdminRecord[]; next_cursor: string | null }>>;
    payment(id: string): Promise<ApiResult<AdminRecord>>;
    correctPayment(
      paymentId: string,
      body: {
        amount_minor?: number;
        correction_class:
          "DUPLICATE_CAPTURE" | "PROVIDER_CORRECTION" | "LEGAL_CORRECTION" | "CHARGEBACK_REVERSAL";
        reason: string;
      },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
    refunds(
      query?: AdminListQuery,
    ): Promise<ApiResult<{ refunds: AdminRecord[]; next_cursor: string | null }>>;
    refundDetail(id: string): Promise<ApiResult<AdminRecord>>;
    cancelSubscription(
      id: string,
      body: { expected_version: number; reason: string },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
    reconcile(body?: { reason?: string }, idempotencyKey?: string): Promise<ApiResult<AdminRecord>>;
  };
  analytics: {
    usage(): Promise<ApiResult<AdminRecord>>;
    organizationUsage(orgId: string): Promise<ApiResult<AdminRecord>>;
  };
  feedback: {
    list(
      query?: AdminListQuery,
    ): Promise<ApiResult<{ feedback: CustomerFeedbackSummary[]; next_cursor: string | null }>>;
    detail(id: string): Promise<ApiResult<{ feedback: CustomerFeedbackSummary }>>;
  };
  audit: {
    list(
      query?: AdminListQuery,
    ): Promise<ApiResult<{ audit: AdminRecord[]; next_cursor: string | null }>>;
  };
  system: {
    health(): Promise<ApiResult<AdminRecord>>;
    jobs(query?: AdminListQuery): Promise<ApiResult<AdminRecord>>;
    outbox(query?: AdminListQuery): Promise<ApiResult<AdminRecord>>;
    quarantine(query?: AdminListQuery): Promise<ApiResult<AdminRecord>>;
    requeueJob(jobId: string, idempotencyKey?: string): Promise<ApiResult<AdminRecord>>;
    requeueOutbox(outboxId: string, idempotencyKey?: string): Promise<ApiResult<AdminRecord>>;
    runReconciler(
      system: "databases" | "quick_databases" | "billing",
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
    quarantineAction(
      id: string,
      action: "approve" | "reject" | "execute",
      body?: AdminRecord,
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
}

/** Fixed operation paths and request bodies; callers still send them through runMutation so
 * CSRF, idempotency, retries, and MFA step-up remain owned by the session boundary. */
export const operationMutations = {
  deploy: (body: DeploymentRequestBody) =>
    ({
      method: "POST",
      path: "/deployments",
      body,
      step_up_action: "admin:deploy",
    }) satisfies MutationInput<DeploymentRequestBody>,
  rollback: (releaseId: string, reason: string) =>
    ({
      method: "POST",
      path: `/deployments/${encodeSegment(releaseId)}:rollback`,
      body: {
        target_release_id: releaseId,
        confirmation: "ROLLBACK",
        reason,
      } satisfies DeploymentRollbackBody,
      step_up_action: "admin:rollback",
    }) satisfies MutationInput<DeploymentRollbackBody>,
  cancel: (id: string, reason: string) =>
    ({
      method: "POST",
      path: `/deployments/${encodeSegment(id)}:cancel`,
      body: { reason } satisfies DeploymentCancelBody,
      step_up_action: "admin:deploy_cancel",
    }) satisfies MutationInput<DeploymentCancelBody>,
  restart: (reason: string) =>
    ({
      method: "POST",
      path: "/system/runtime:restart",
      body: { reason } satisfies SecretReasonBody,
      step_up_action: "admin:restart",
    }) satisfies MutationInput<SecretReasonBody>,
  validateConfig: (body: ConfigValidateBody) =>
    ({
      method: "POST",
      path: "/system/config/validate",
      body,
    }) satisfies MutationInput<ConfigValidateBody>,
  saveConfig: (body: ConfigSaveBody) =>
    ({
      method: "PUT",
      path: "/system/config",
      body,
      step_up_action: "admin:config",
    }) satisfies MutationInput<ConfigSaveBody>,
  revertConfig: (body: ConfigRevertBody) =>
    ({
      method: "POST",
      path: "/system/config/revert",
      body,
      step_up_action: "admin:config_revert",
    }) satisfies MutationInput<ConfigRevertBody>,
  createSecret: (body: SecretCreateBody) =>
    ({
      method: "POST",
      path: "/system/secrets",
      body,
      step_up_action: "admin:secret_write",
    }) satisfies MutationInput<SecretCreateBody>,
  replaceSecret: (name: string, body: SecretReplaceBody) =>
    ({
      method: "PUT",
      path: `/system/secrets/${encodeSegment(name)}`,
      body,
      step_up_action: "admin:secret_write",
    }) satisfies MutationInput<SecretReplaceBody>,
  deleteSecret: (name: string, body: SecretReasonBody) =>
    ({
      method: "DELETE",
      path: `/system/secrets/${encodeSegment(name)}`,
      body,
      step_up_action: "admin:secret_delete",
    }) satisfies MutationInput<SecretReasonBody>,
  revertSecret: (name: string, body: SecretReasonBody) =>
    ({
      method: "POST",
      path: `/system/secrets/${encodeSegment(name)}:revert`,
      body,
      step_up_action: "admin:secret_revert",
    }) satisfies MutationInput<SecretReasonBody>,
  revealSecret: (name: string, body: SecretReasonBody) =>
    ({
      method: "POST",
      path: `/system/secrets/${encodeSegment(name)}:reveal`,
      body,
      step_up_action: "admin:secret_reveal",
    }) satisfies MutationInput<SecretReasonBody>,
};

function actionPath(prefix: string, id: string, action: string): string {
  return `${prefix}/${encodeSegment(id)}:${action}`;
}

function keyOptions(idempotencyKey?: string) {
  return idempotencyKey ? { idempotencyKey } : undefined;
}

function pickQuery(
  query: AdminListQuery | undefined,
  allowed: readonly string[],
): AdminListQuery | undefined {
  if (!query) return undefined;
  const result: AdminListQuery = {};
  for (const key of allowed) {
    const value = query[key];
    if (value !== undefined && value !== null && value !== "") result[key] = value;
  }
  return result;
}

export function createAdminApi(client: AdminApiClient): AdminAuthApi & AdminResourceApi {
  const auth: AdminAuthApi = {
    login: (body) =>
      client.post<AdminLoginResult, AdminLoginBody>("/auth/login", body, {
        requiresIdempotency: false,
        requiresCsrf: false,
      }),
    me: () => client.get<AdminMe>("/auth/me"),
    refresh: () =>
      client.post<AdminSessionResult, Record<string, never>>("/auth/refresh", {}, keyOptions()),
    logout: () =>
      client.post<{ logged_out: true }, Record<string, never>>("/auth/logout", {}, keyOptions()),
    sessions: () => client.get<{ sessions: AdminSessionSummary[] }>("/auth/sessions"),
    revokeSession: (id, key) =>
      client.post<{ revoked: true }, Record<string, never>>(
        actionPath("/auth/sessions", id, "revoke"),
        {},
        keyOptions(key),
      ),
    revokeAll: (key) =>
      client.post<{ revoked: number }, Record<string, never>>(
        "/auth/sessions/revoke-all",
        {},
        keyOptions(key),
      ),
    enrollMfa: (key) =>
      client.post<{ secret: string; otpauth_uri: string }, Record<string, never>>(
        "/auth/mfa/enroll",
        {},
        keyOptions(key),
      ),
    confirmMfa: (code, key) =>
      client.post<{ recovery_codes: string[] }, { code: string }>(
        "/auth/mfa/confirm",
        { code },
        keyOptions(key),
      ),
    rotateRecoveryCodes: (code, key) =>
      client.post<{ recovery_codes: string[] }, { code: string }>(
        "/auth/mfa/recovery-codes/rotate",
        { code },
        keyOptions(key),
      ),
    rotatePassword: (body, key) =>
      client.post<{ rotated: true }, typeof body>("/auth/password/rotate", body, keyOptions(key)),
    acceptInvitation: (token, body, key) =>
      client.post<AdminLoginResult, AdminAcceptInvitationBody>(
        actionPath("/invitations", token, "accept"),
        body,
        keyOptions(key),
      ),
  };

  const resources: AdminResourceApi = {
    operations: {
      status: () => client.get<RuntimeStatus>("/deploy/status"),
      runtime: () => client.get<RuntimeStatus>("/system/runtime"),
      remote: () => client.get("/deploy/remote"),
      history: () => client.get<{ deployments: DeploymentOperation[] }>("/deploy/history"),
      detail: (id) => client.get<DeploymentOperation>(`/deploy/history/${encodeSegment(id)}`),
      logs: (id, after) =>
        client.get<{ lines: DeploymentLogLine[]; next_offset: number }>(
          `/deploy/history/${encodeSegment(id)}/logs`,
          { after },
        ),
      config: () => client.get<RuntimeConfigView>("/system/config"),
      secrets: () => client.get<{ secrets: SecretSummary[] }>("/system/secrets"),
    },
    admins: {
      list: () => client.get<{ admins: AdminUserSummary[] }>("/admins"),
      invite: (body, key) =>
        client.post<AdminInvitationResult, AdminInvitationBody>(
          "/invitations",
          body,
          keyOptions(key),
        ),
      patch: (id, body, key) =>
        client.patch<AdminRecord, AdminRecord>(
          `/admins/${encodeSegment(id)}`,
          body,
          keyOptions(key),
        ),
      disable: (id, expected_version, key) =>
        client.post<{ disabled: true }, { expected_version: number }>(
          actionPath("/admins", id, "disable"),
          { expected_version },
          keyOptions(key),
        ),
    },
    invitations: {
      list: () => client.get<{ invitations: AdminInvitationSummary[] }>("/invitations"),
      revoke: (id, key) =>
        client.post<AdminRecord, Record<string, never>>(
          actionPath("/invitations", id, "revoke"),
          {},
          keyOptions(key),
        ),
    },
    users: {
      list: (query) =>
        client.get<{ users: CustomerUserSummary[]; next_cursor: string | null }>(
          "/users",
          pickQuery(query, [
            "cursor",
            "limit",
            "status",
            "email",
            "tier_id",
            "sort_by",
            "sort_order",
          ]),
        ),
      detail: (id) => client.get<CustomerUserDetail>(`/users/${encodeSegment(id)}`),
      action: (id, action, body, key) =>
        client.post<AdminRecord, typeof body>(
          actionPath("/users", id, action),
          body,
          keyOptions(key),
        ),
      tierAssignments: (id) =>
        client.get<{ assignments: TierAssignmentSummary[] }>(
          `/users/${encodeSegment(id)}/tier-assignments`,
        ),
      assignTier: (id, body, key) =>
        client.post<{ assignment: TierAssignmentSummary; tier: TierRevision }, TierAssignmentBody>(
          `/users/${encodeSegment(id)}/tier-assignments`,
          body,
          keyOptions(key),
        ),
      revokeTierAssignment: (userId, assignmentId, body, key) =>
        client.post<AdminRecord, typeof body>(
          actionPath(`/users/${encodeSegment(userId)}/tier-assignments`, assignmentId, "revoke"),
          body,
          keyOptions(key),
        ),
    },
    organizations: {
      list: (query) =>
        client.get<{ orgs: OrganizationSummary[]; next_cursor: string | null }>(
          "/orgs",
          pickQuery(query, [
            "cursor",
            "limit",
            "state",
            "plan_code",
            "kind",
            "owner_user_id",
            "sort_by",
            "sort_order",
          ]),
        ),
      detail: (id) => client.get<OrganizationDetail>(`/orgs/${encodeSegment(id)}`),
      action: (id, action, body, key) =>
        client.post<AdminRecord, typeof body>(
          actionPath("/orgs", id, action),
          body,
          keyOptions(key),
        ),
    },
    catalogue: {
      revisions: () =>
        client.get<{
          kind: "plans";
          revisions: CatalogueRevision[];
          active_catalogue: ActiveProductCatalogue;
        }>("/plans"),
      revision: (id) =>
        client.get<{
          kind: "plans";
          revision: CatalogueRevision;
          definition: ProductCatalogueDraft;
        }>(`/plans/versions/${encodeSegment(id)}`),
      createDraft: (body, key) =>
        client.post<{ revision: CatalogueRevision }, ProductCatalogueDraft>(
          "/plans/versions",
          body,
          keyOptions(key),
        ),
      diff: (id) => client.get<AdminRecord>(`/plans/versions/${encodeSegment(id)}:diff`),
      action: (id, action, body, key) =>
        client.post<CatalogueActionResult, typeof body>(
          actionPath("/plans/versions", id, action),
          body,
          keyOptions(key),
        ),
      features: () => client.get<AdminRecord>("/features"),
      setFeature: (key, body, idempotencyKey) =>
        client.patch<AdminRecord, typeof body>(
          `/features/${encodeSegment(key)}`,
          body,
          keyOptions(idempotencyKey),
        ),
    },
    quotas: {
      get: (id) => client.get<AdminRecord>(`/quotas/${encodeSegment(id)}`),
      set: (id, body, key) =>
        client.patch<AdminRecord, AdminRecord>(
          `/quotas/${encodeSegment(id)}`,
          body,
          keyOptions(key),
        ),
      clear: (id, keyName, expected_version, key) =>
        client.delete<AdminRecord, { expected_version: number }>(
          actionPath(`/quotas/${encodeSegment(id)}`, keyName, "clear"),
          { expected_version },
          keyOptions(key),
        ),
    },
    databases: {
      list: (query) =>
        client.get<{ databases: AdminRecord[]; next_cursor: string | null }>(
          "/databases",
          pickQuery(query, [
            "cursor",
            "limit",
            "sort_order",
            "org_id",
            "project_id",
            "kind",
            "state",
            "sort_by",
          ]),
        ),
      detail: (id) => client.get<AdminRecord>(`/databases/${encodeSegment(id)}`),
      action: (id, action, body, key) =>
        client.post<AdminRecord, AdminRecord>(
          actionPath("/databases", id, action),
          body,
          keyOptions(key),
        ),
    },
    quickDatabases: {
      list: (query) =>
        client.get<{
          quick_databases: AdminRecord[];
          quota: AdminRecord | null;
          next_cursor: string | null;
        }>(
          "/quick-databases",
          pickQuery(query, ["cursor", "limit", "sort_order", "org_id", "kind", "state"]),
        ),
      detail: (id) =>
        client.get<{ quick_database: AdminRecord }>(`/quick-databases/${encodeSegment(id)}`),
    },
    tiers: {
      list: () => client.get<{ tiers: CustomTierSummary[]; next_cursor: string | null }>("/tiers"),
      detail: (id) =>
        client.get<{
          tier: CustomTierSummary;
          revisions?: TierRevision[];
          assignments: TierAssignmentSummary[];
        }>(`/tiers/${encodeSegment(id)}`),
      create: (body, key) =>
        client.post<{ tier: CustomTierSummary }, CustomTierDraftBody & { key: string }>(
          "/tiers",
          body,
          keyOptions(key),
        ),
      patch: (id, body, key) =>
        client.patch<
          { tier: CustomTierSummary },
          CustomTierDraftBody & { expected_version: number }
        >(`/tiers/${encodeSegment(id)}`, body, keyOptions(key)),
      action: (id, action, body, key) =>
        client.post<{ tier: CustomTierSummary }, typeof body>(
          actionPath("/tiers", id, action),
          body,
          keyOptions(key),
        ),
    },
    billing: {
      subscriptions: (query) =>
        client.get<{ subscriptions: AdminRecord[]; next_cursor: string | null }>(
          "/billing/subscriptions",
          pickQuery(query, [
            "cursor",
            "limit",
            "sort_order",
            "org_id",
            "status",
            "plan_code",
            "currency",
            "sort_by",
          ]),
        ),
      subscription: (id) => client.get<AdminRecord>(`/billing/subscriptions/${encodeSegment(id)}`),
      invoices: (query) =>
        client.get<{ invoices: AdminRecord[]; next_cursor: string | null }>(
          "/billing/invoices",
          pickQuery(query, [
            "cursor",
            "limit",
            "sort_order",
            "org_id",
            "status",
            "currency",
            "sort_by",
          ]),
        ),
      invoice: (id) => client.get<AdminRecord>(`/billing/invoices/${encodeSegment(id)}`),
      payments: (query) =>
        client.get<{ payments: AdminRecord[]; next_cursor: string | null }>(
          "/billing/payments",
          pickQuery(query, [
            "cursor",
            "limit",
            "sort_order",
            "org_id",
            "invoice_id",
            "status",
            "sort_by",
          ]),
        ),
      payment: (id) => client.get<AdminRecord>(`/billing/payments/${encodeSegment(id)}`),
      correctPayment: (id, body, key) =>
        client.post<AdminRecord, typeof body>(
          actionPath("/billing/payments", id, "correct"),
          body,
          { ...keyOptions(key), moneyMoving: true },
        ),
      refunds: (query) =>
        client.get<{ refunds: AdminRecord[]; next_cursor: string | null }>(
          "/billing/refunds",
          pickQuery(query, [
            "cursor",
            "limit",
            "sort_order",
            "org_id",
            "payment_id",
            "status",
            "sort_by",
          ]),
        ),
      refundDetail: (id) => client.get<AdminRecord>(`/billing/refunds/${encodeSegment(id)}`),
      cancelSubscription: (id, body, key) =>
        client.post<AdminRecord, typeof body>(
          actionPath("/billing/subscriptions", id, "cancel"),
          body,
          keyOptions(key),
        ),
      reconcile: (body, key) =>
        client.post<AdminRecord, typeof body>("/billing/reconcile", body ?? {}, keyOptions(key)),
    },
    analytics: {
      usage: () => client.get<AdminRecord>("/usage"),
      organizationUsage: (id) => client.get<AdminRecord>(`/usage/orgs/${encodeSegment(id)}`),
    },
    feedback: {
      list: (query) =>
        client.get<{ feedback: CustomerFeedbackSummary[]; next_cursor: string | null }>(
          "/feedback",
          pickQuery(query, [
            "cursor",
            "limit",
            "stars",
            "user_id",
            "from",
            "to",
            "sort_by",
            "sort_order",
          ]),
        ),
      detail: (id) =>
        client.get<{ feedback: CustomerFeedbackSummary }>(`/feedback/${encodeSegment(id)}`),
    },
    audit: {
      list: (query) =>
        client.get<{ audit: AdminRecord[]; next_cursor: string | null }>(
          "/audit",
          pickQuery(query, [
            "cursor",
            "limit",
            "sort_by",
            "sort_order",
            "actor_id",
            "action",
            "target_type",
            "target_id",
            "outcome",
            "org_id",
            "from",
            "to",
          ]),
        ),
    },
    system: {
      health: () => client.get<AdminRecord>("/system/health"),
      jobs: (query) =>
        client.get<AdminRecord>(
          "/system/jobs",
          pickQuery(query, ["cursor", "limit", "state", "type"]),
        ),
      outbox: (query) =>
        client.get<AdminRecord>(
          "/system/outbox",
          pickQuery(query, ["cursor", "limit", "state", "intent"]),
        ),
      quarantine: (query) =>
        client.get<AdminRecord>(
          "/system/quarantine",
          pickQuery(query, ["cursor", "limit", "system", "state", "drift_class", "sort_order"]),
        ),
      requeueJob: (id, key) =>
        client.post<AdminRecord, Record<string, never>>(
          actionPath("/system/jobs", id, "requeue"),
          {},
          keyOptions(key),
        ),
      requeueOutbox: (id, key) =>
        client.post<AdminRecord, Record<string, never>>(
          actionPath("/system/outbox", id, "requeue"),
          {},
          keyOptions(key),
        ),
      runReconciler: (system, key) =>
        client.post<AdminRecord, Record<string, never>>(
          actionPath("/system/reconcilers", system, "run"),
          {},
          keyOptions(key),
        ),
      quarantineAction: (id, action, body, key) =>
        client.post<AdminRecord, AdminRecord>(
          actionPath("/system/quarantine", id, action),
          body ?? {},
          keyOptions(key),
        ),
    },
  };

  return { ...auth, ...resources };
}

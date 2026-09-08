import { AdminApiClient, type ApiResult } from "./client";
import type { AdminAcceptInvitationBody, AdminInvitationBody, AdminLoginBody } from "./bodies";
import type {
  AdminInvitationResult,
  AdminInvitationSummary,
  AdminLoginResult,
  AdminMe,
  AdminRecord,
  AdminSessionResult,
  AdminSessionSummary,
  AdminUserSummary,
  CatalogueActionResult,
  CatalogueRevision,
  CustomerUserDetail,
  CustomerUserSummary,
  OrganizationDetail,
  OrganizationSummary,
  PlanDraftItem,
  ServiceDraftItem,
} from "./types";
import { encodeSegment } from "./client";

export interface AdminAuthApi {
  login(body: AdminLoginBody): Promise<ApiResult<AdminLoginResult>>;
  me(): Promise<ApiResult<AdminMe>>;
  refresh(): Promise<ApiResult<AdminSessionResult>>;
  logout(): Promise<ApiResult<{ logged_out: true }>>;
  sessions(): Promise<ApiResult<{ sessions: AdminSessionSummary[] }>>;
  revokeSession(sessionId: string, idempotencyKey?: string): Promise<ApiResult<{ revoked: true }>>;
  revokeAll(idempotencyKey?: string): Promise<ApiResult<AdminRecord>>;
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
      query?: AdminRecord,
    ): Promise<ApiResult<{ users: CustomerUserSummary[]; next_cursor: string | null }>>;
    detail(userId: string): Promise<ApiResult<CustomerUserDetail>>;
    action(
      userId: string,
      action: "suspend" | "restore",
      body: { reason: string; expected_version: number },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
  organizations: {
    list(
      query?: AdminRecord,
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
    revisions(
      kind: "plans" | "services" | "vps",
    ): Promise<ApiResult<{ kind: string; revisions: CatalogueRevision[] }>>;
    createPlanDraft(
      body: { source_sha256?: string; plans: PlanDraftItem[] },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
    createServiceDraft(
      body: { source_sha256?: string; services: ServiceDraftItem[] },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
    createVpsDraft(body: AdminRecord, idempotencyKey?: string): Promise<ApiResult<AdminRecord>>;
    diff(kind: "plans" | "services" | "vps", revision: number): Promise<ApiResult<AdminRecord>>;
    action(
      kind: "plans" | "services" | "vps",
      revision: number,
      action: "validate" | "publish" | "retire",
      body: { expected_version: number },
      idempotencyKey?: string,
    ): Promise<ApiResult<CatalogueActionResult>>;
    activeServices(): Promise<ApiResult<AdminRecord>>;
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
  hosting: {
    projects(
      query?: AdminRecord,
    ): Promise<ApiResult<{ hosting_projects: AdminRecord[]; next_cursor: string | null }>>;
    project(projectId: string): Promise<ApiResult<AdminRecord>>;
    projectAction(
      projectId: string,
      action: string,
      body: AdminRecord,
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
    deployments(
      query?: AdminRecord,
    ): Promise<ApiResult<{ deployments: AdminRecord[]; next_cursor: string | null }>>;
    deployment(deploymentId: string): Promise<ApiResult<AdminRecord>>;
    deploymentAction(
      deploymentId: string,
      action: string,
      body?: AdminRecord,
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
  domains: {
    list(
      query?: AdminRecord,
    ): Promise<ApiResult<{ domains: AdminRecord[]; next_cursor: string | null }>>;
    detail(domainId: string): Promise<ApiResult<AdminRecord>>;
    action(
      domainId: string,
      action: string,
      body: AdminRecord,
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
  databases: {
    list(
      query?: AdminRecord,
    ): Promise<ApiResult<{ databases: AdminRecord[]; next_cursor: string | null }>>;
    detail(databaseId: string): Promise<ApiResult<AdminRecord>>;
    action(
      databaseId: string,
      action: string,
      body: AdminRecord,
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
  vps: {
    list(
      query?: AdminRecord,
    ): Promise<ApiResult<{ vps: AdminRecord[]; next_cursor: string | null }>>;
    detail(vpsId: string): Promise<ApiResult<AdminRecord>>;
    action(
      vpsId: string,
      action: string,
      body: AdminRecord,
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
  };
  billing: {
    subscriptions(
      query?: AdminRecord,
    ): Promise<ApiResult<{ subscriptions: AdminRecord[]; next_cursor: string | null }>>;
    subscription(id: string): Promise<ApiResult<AdminRecord>>;
    invoices(
      query?: AdminRecord,
    ): Promise<ApiResult<{ invoices: AdminRecord[]; next_cursor: string | null }>>;
    invoice(id: string): Promise<ApiResult<AdminRecord>>;
    payments(
      query?: AdminRecord,
    ): Promise<ApiResult<{ payments: AdminRecord[]; next_cursor: string | null }>>;
    payment(id: string): Promise<ApiResult<AdminRecord>>;
    refund(
      paymentId: string,
      body: { amount_minor?: number; reason: string },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
    refunds(
      query?: AdminRecord,
    ): Promise<ApiResult<{ refunds: AdminRecord[]; next_cursor: string | null }>>;
    refundDetail(id: string): Promise<ApiResult<AdminRecord>>;
    cancelSubscription(
      id: string,
      body: { expected_version: number; immediate?: boolean; reason: string },
      idempotencyKey?: string,
    ): Promise<ApiResult<AdminRecord>>;
    reconcile(body?: { reason?: string }, idempotencyKey?: string): Promise<ApiResult<AdminRecord>>;
  };
  analytics: {
    usage(): Promise<ApiResult<AdminRecord>>;
    organizationUsage(orgId: string): Promise<ApiResult<AdminRecord>>;
  };
  audit: {
    list(
      query?: AdminRecord,
    ): Promise<ApiResult<{ audit: AdminRecord[]; next_cursor: string | null }>>;
  };
  system: {
    health(): Promise<ApiResult<AdminRecord>>;
    workers(): Promise<ApiResult<{ workers: AdminRecord[] }>>;
    jobs(query?: AdminRecord): Promise<ApiResult<AdminRecord>>;
    outbox(query?: AdminRecord): Promise<ApiResult<AdminRecord>>;
    quarantine(query?: AdminRecord): Promise<ApiResult<AdminRecord>>;
    requeueJob(jobId: string, idempotencyKey?: string): Promise<ApiResult<AdminRecord>>;
    requeueOutbox(outboxId: string, idempotencyKey?: string): Promise<ApiResult<AdminRecord>>;
    runReconciler(
      system: "hosting" | "databases" | "vps" | "billing",
      body?: { reason?: string },
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

function actionPath(prefix: string, id: string, action: string): string {
  return `${prefix}/${encodeSegment(id)}:${action}`;
}

function keyOptions(idempotencyKey?: string) {
  return idempotencyKey ? { idempotencyKey } : undefined;
}

export function createAdminApi(client: AdminApiClient): AdminAuthApi & AdminResourceApi {
  const auth: AdminAuthApi = {
    login: (body) =>
      client.post<AdminLoginResult, AdminLoginBody>("/auth/login", body, {
        requiresIdempotency: false,
        requiresCsrf: false,
        retryNetwork: false,
      }),
    me: () => client.get<AdminMe>("/auth/me"),
    refresh: () =>
      client.post<AdminSessionResult, Record<string, never>>("/auth/refresh", {}, keyOptions()),
    logout: () =>
      client.post<{ logged_out: true }, Record<string, never>>("/auth/logout", {}, keyOptions()),
    sessions: () => client.get<{ sessions: AdminSessionSummary[] }>("/auth/sessions"),
    revokeSession: (sessionId, idempotencyKey) =>
      client.post<{ revoked: true }, Record<string, never>>(
        actionPath("/auth/sessions", sessionId, "revoke"),
        {},
        keyOptions(idempotencyKey),
      ),
    revokeAll: (idempotencyKey) =>
      client.post<AdminRecord, Record<string, never>>(
        "/auth/sessions/revoke-all",
        {},
        keyOptions(idempotencyKey),
      ),
    enrollMfa: (idempotencyKey) =>
      client.post<{ secret: string; otpauth_uri: string }, Record<string, never>>(
        "/auth/mfa/enroll",
        {},
        keyOptions(idempotencyKey),
      ),
    confirmMfa: (code, idempotencyKey) =>
      client.post<{ recovery_codes: string[] }, { code: string }>(
        "/auth/mfa/confirm",
        { code },
        keyOptions(idempotencyKey),
      ),
    rotateRecoveryCodes: (code, idempotencyKey) =>
      client.post<{ recovery_codes: string[] }, { code: string }>(
        "/auth/mfa/recovery-codes/rotate",
        { code },
        keyOptions(idempotencyKey),
      ),
    rotatePassword: (body, idempotencyKey) =>
      client.post<{ rotated: true }, typeof body>(
        "/auth/password/rotate",
        body,
        keyOptions(idempotencyKey),
      ),
    acceptInvitation: (token, body, idempotencyKey) =>
      client.post<AdminLoginResult, AdminAcceptInvitationBody>(
        actionPath("/invitations", token, "accept"),
        body,
        keyOptions(idempotencyKey),
      ),
  };

  const resources: AdminResourceApi = {
    admins: {
      list: () => client.get<{ admins: AdminUserSummary[] }>("/admins"),
      invite: (body, idempotencyKey) =>
        client.post<AdminInvitationResult, AdminInvitationBody>(
          "/invitations",
          body,
          keyOptions(idempotencyKey),
        ),
      patch: (id, body, idempotencyKey) =>
        client.patch<AdminRecord, AdminRecord>(
          `/admins/${encodeSegment(id)}`,
          body,
          keyOptions(idempotencyKey),
        ),
      disable: (id, expected_version, idempotencyKey) =>
        client.post<{ disabled: true }, { expected_version: number }>(
          actionPath("/admins", id, "disable"),
          { expected_version },
          keyOptions(idempotencyKey),
        ),
    },
    invitations: {
      list: () => client.get<{ invitations: AdminInvitationSummary[] }>("/invitations"),
      revoke: (id, idempotencyKey) =>
        client.post<AdminRecord, Record<string, never>>(
          actionPath("/invitations", id, "revoke"),
          {},
          keyOptions(idempotencyKey),
        ),
    },
    users: {
      list: (query) =>
        client.get<{ users: CustomerUserSummary[]; next_cursor: string | null }>(
          "/users",
          query as never,
        ),
      detail: (id) => client.get<CustomerUserDetail>(`/users/${encodeSegment(id)}`),
      action: (id, action, body, idempotencyKey) =>
        client.post<AdminRecord, typeof body>(
          actionPath("/users", id, action),
          body,
          keyOptions(idempotencyKey),
        ),
    },
    organizations: {
      list: (query) =>
        client.get<{ orgs: OrganizationSummary[]; next_cursor: string | null }>(
          "/orgs",
          query as never,
        ),
      detail: (id) => client.get<OrganizationDetail>(`/orgs/${encodeSegment(id)}`),
      action: (id, action, body, idempotencyKey) =>
        client.post<AdminRecord, typeof body>(
          actionPath("/orgs", id, action),
          body,
          keyOptions(idempotencyKey),
        ),
    },
    catalogue: {
      revisions: (kind) => client.get<{ kind: string; revisions: CatalogueRevision[] }>(`/${kind}`),
      createPlanDraft: (body, idempotencyKey) =>
        client.post<AdminRecord, typeof body>("/plans/versions", body, keyOptions(idempotencyKey)),
      createServiceDraft: (body, idempotencyKey) =>
        client.post<AdminRecord, typeof body>(
          "/services/versions",
          body,
          keyOptions(idempotencyKey),
        ),
      createVpsDraft: (body, idempotencyKey) =>
        client.post<AdminRecord, AdminRecord>("/vps/versions", body, keyOptions(idempotencyKey)),
      diff: (kind, revision) => client.get<AdminRecord>(`/${kind}/versions/${revision}:diff`),
      action: (kind, revision, action, body, idempotencyKey) =>
        client.post<CatalogueActionResult, typeof body>(
          `/${kind}/versions/${revision}:${action}`,
          body,
          keyOptions(idempotencyKey),
        ),
      activeServices: () => client.get<AdminRecord>("/services/catalog"),
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
      set: (id, body, idempotencyKey) =>
        client.patch<AdminRecord, AdminRecord>(
          `/quotas/${encodeSegment(id)}`,
          body,
          keyOptions(idempotencyKey),
        ),
      clear: (id, keyName, expected_version, idempotencyKey) =>
        client.delete<AdminRecord, { expected_version: number }>(
          actionPath(`/quotas/${encodeSegment(id)}`, keyName, "clear"),
          { expected_version },
          keyOptions(idempotencyKey),
        ),
    },
    hosting: {
      projects: (query) =>
        client.get<{ hosting_projects: AdminRecord[]; next_cursor: string | null }>(
          "/hosting/projects",
          query as never,
        ),
      project: (id) => client.get<AdminRecord>(`/hosting/projects/${encodeSegment(id)}`),
      projectAction: (id, action, body, idempotencyKey) =>
        client.post<AdminRecord, AdminRecord>(
          actionPath("/hosting/projects", id, action),
          body,
          keyOptions(idempotencyKey),
        ),
      deployments: (query) =>
        client.get<{ deployments: AdminRecord[]; next_cursor: string | null }>(
          "/hosting/deployments",
          query as never,
        ),
      deployment: (id) => client.get<AdminRecord>(`/hosting/deployments/${encodeSegment(id)}`),
      deploymentAction: (id, action, body, idempotencyKey) =>
        client.post<AdminRecord, AdminRecord>(
          actionPath("/hosting/deployments", id, action),
          body ?? {},
          keyOptions(idempotencyKey),
        ),
    },
    domains: {
      list: (query) =>
        client.get<{ domains: AdminRecord[]; next_cursor: string | null }>(
          "/domains",
          query as never,
        ),
      detail: (id) => client.get<AdminRecord>(`/domains/${encodeSegment(id)}`),
      action: (id, action, body, idempotencyKey) =>
        client.post<AdminRecord, AdminRecord>(
          actionPath("/domains", id, action),
          body,
          keyOptions(idempotencyKey),
        ),
    },
    databases: {
      list: (query) =>
        client.get<{ databases: AdminRecord[]; next_cursor: string | null }>(
          "/databases",
          query as never,
        ),
      detail: (id) => client.get<AdminRecord>(`/databases/${encodeSegment(id)}`),
      action: (id, action, body, idempotencyKey) =>
        client.post<AdminRecord, AdminRecord>(
          actionPath("/databases", id, action),
          body,
          keyOptions(idempotencyKey),
        ),
    },
    vps: {
      list: (query) =>
        client.get<{ vps: AdminRecord[]; next_cursor: string | null }>(
          "/infrastructure/vps",
          query as never,
        ),
      detail: (id) => client.get<AdminRecord>(`/infrastructure/vps/${encodeSegment(id)}`),
      action: (id, action, body, idempotencyKey) =>
        client.post<AdminRecord, AdminRecord>(
          actionPath("/infrastructure/vps", id, action),
          body,
          keyOptions(idempotencyKey),
        ),
    },
    billing: {
      subscriptions: (query) =>
        client.get<{ subscriptions: AdminRecord[]; next_cursor: string | null }>(
          "/billing/subscriptions",
          query as never,
        ),
      subscription: (id) => client.get<AdminRecord>(`/billing/subscriptions/${encodeSegment(id)}`),
      invoices: (query) =>
        client.get<{ invoices: AdminRecord[]; next_cursor: string | null }>(
          "/billing/invoices",
          query as never,
        ),
      invoice: (id) => client.get<AdminRecord>(`/billing/invoices/${encodeSegment(id)}`),
      payments: (query) =>
        client.get<{ payments: AdminRecord[]; next_cursor: string | null }>(
          "/billing/payments",
          query as never,
        ),
      payment: (id) => client.get<AdminRecord>(`/billing/payments/${encodeSegment(id)}`),
      refund: (id, body, idempotencyKey) =>
        client.post<AdminRecord, typeof body>(
          actionPath("/billing/payments", id, "refund"),
          body,
          keyOptions(idempotencyKey),
        ),
      refunds: (query) =>
        client.get<{ refunds: AdminRecord[]; next_cursor: string | null }>(
          "/billing/refunds",
          query as never,
        ),
      refundDetail: (id) => client.get<AdminRecord>(`/billing/refunds/${encodeSegment(id)}`),
      cancelSubscription: (id, body, idempotencyKey) =>
        client.post<AdminRecord, typeof body>(
          actionPath("/billing/subscriptions", id, "cancel"),
          body,
          keyOptions(idempotencyKey),
        ),
      reconcile: (body, idempotencyKey) =>
        client.post<AdminRecord, typeof body>(
          "/billing/reconcile",
          body ?? {},
          keyOptions(idempotencyKey),
        ),
    },
    analytics: {
      usage: () => client.get<AdminRecord>("/usage"),
      organizationUsage: (id) => client.get<AdminRecord>(`/usage/orgs/${encodeSegment(id)}`),
    },
    audit: {
      list: (query) =>
        client.get<{ audit: AdminRecord[]; next_cursor: string | null }>("/audit", query as never),
    },
    system: {
      health: () => client.get<AdminRecord>("/system/health"),
      workers: () => client.get<{ workers: AdminRecord[] }>("/system/workers"),
      jobs: (query) => client.get<AdminRecord>("/system/jobs", query as never),
      outbox: (query) => client.get<AdminRecord>("/system/outbox", query as never),
      quarantine: (query) => client.get<AdminRecord>("/system/quarantine", query as never),
      requeueJob: (id, idempotencyKey) =>
        client.post<AdminRecord, Record<string, never>>(
          actionPath("/system/jobs", id, "requeue"),
          {},
          keyOptions(idempotencyKey),
        ),
      requeueOutbox: (id, idempotencyKey) =>
        client.post<AdminRecord, Record<string, never>>(
          actionPath("/system/outbox", id, "requeue"),
          {},
          keyOptions(idempotencyKey),
        ),
      runReconciler: (system, body, idempotencyKey) =>
        client.post<AdminRecord, typeof body>(
          actionPath("/system/reconcilers", system, "run"),
          body ?? {},
          keyOptions(idempotencyKey),
        ),
      quarantineAction: (id, action, body, idempotencyKey) =>
        client.post<AdminRecord, AdminRecord>(
          actionPath("/system/quarantine", id, action),
          body ?? {},
          keyOptions(idempotencyKey),
        ),
    },
  };

  return { ...auth, ...resources };
}

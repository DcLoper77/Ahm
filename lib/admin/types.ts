export type AdminRole =
  "ROOT" | "PLATFORM_ADMIN" | "SUPPORT_OPERATOR" | "BILLING_ADMIN" | "INFRA_ADMIN" | "ANALYST";

export type AdminPermission =
  | "*"
  | "admins.read"
  | "admins.invite"
  | "users.read"
  | "users.suspend"
  | "orgs.read"
  | "orgs.suspend"
  | "catalog.read"
  | "catalog.write"
  | "catalog.publish"
  | "quotas.read"
  | "quotas.write"
  | "system.read"
  | "system.write"
  | "billing.read"
  | "billing.write"
  | "hosting.read"
  | "hosting.write"
  | "domains.read"
  | "domains.write"
  | "databases.read"
  | "databases.write"
  | "vps.read"
  | "vps.write"
  | "analytics.read"
  | "audit.read";

export type AdminStatus = "ACTIVE" | "DISABLED";

export interface AdminMe {
  id: string;
  email: string;
  roles: AdminRole[];
  mfa_enabled: boolean;
  mfa_satisfied: boolean;
  session_id: string;
}

export interface AdminLoginResult {
  admin_user_id: string;
  roles: AdminRole[];
  mfa_enrollment_required: boolean;
  idle_expires_at: string;
  absolute_expires_at: string;
}

export interface AdminSessionResult {
  session_id: string;
  idle_expires_at: string;
  absolute_expires_at: string;
}

export interface AdminSessionSummary {
  id: string;
  current: boolean;
  created_at: string;
  last_seen_at: string;
  idle_expires_at: string;
  absolute_expires_at: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  roles: AdminRole[];
  status: AdminStatus;
  version: number;
  created_at?: string;
  last_seen_at?: string | null;
  session_count?: number;
}

export interface AdminInvitationSummary {
  id: string;
  invitation_id?: string;
  email: string;
  roles: AdminRole[];
  status?: string;
  expires_at: string;
  created_at?: string;
}

export interface AdminInvitationResult {
  invitation_id: string;
  email: string;
  roles: AdminRole[];
  expires_at: string;
  token: string;
}

export interface MfaEnrollmentResult {
  secret: string;
  otpauth_uri: string;
}

export interface MfaConfirmationResult {
  recovery_codes: string[];
}

export interface CursorPage<T> {
  next_cursor: string | null;
  [key: string]: T[] | string | null | undefined;
}

export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export interface CustomerUserSummary {
  id: string;
  email?: string | null;
  masked_email?: string | null;
  name?: string | null;
  masked_name?: string | null;
  status: UserStatus;
  version: number;
  created_at: string;
  updated_at?: string;
  organization_count?: number;
}

export interface CustomerUserDetail {
  user: CustomerUserSummary & Record<string, unknown>;
  organizations: AdminRecord[];
}

export type OrganizationState =
  "ACTIVE" | "PAST_DUE" | "GRACE" | "READ_ONLY" | "SUSPENDED" | "DELETING" | "DELETED";

export interface OrganizationSummary {
  id: string;
  name?: string;
  slug?: string;
  kind?: "PERSONAL" | "TEAM";
  state?: OrganizationState;
  plan_code?: "free" | "developer" | "founder";
  owner_user_id?: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

export interface OrganizationDetail {
  org: OrganizationSummary & Record<string, unknown>;
}

export interface CatalogueRevision {
  id: string;
  revision: number;
  state: "DRAFT" | "PUBLISHED" | "RETIRED";
  parity_state: "UNVERIFIED" | "VERIFIED" | "MISMATCH";
  parity_sha256: string | null;
  source_sha256: string | null;
  created_by: string | null;
  published_by: string | null;
  published_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CatalogueActionResult {
  revision?: CatalogueRevision;
  parity_sha256?: string;
  active_resource_impact?: {
    active_plan_subscriptions: number;
    active_vps_instances: number;
    active_vps_items: number;
    active_services: number;
    services_over_new_function_limit: number;
  };
  rematerialization_job_id?: string | null;
  runtime_activation?: "ACTIVE" | "PENDING";
}

export interface PlanPrice {
  usd_minor: number;
  inr_minor: number;
}

export interface PlanLimits {
  storage_bytes: number;
  projects: number;
  team_members: number;
  store_per_project: number;
  kv_per_project: number;
  box_per_project: number;
  sql_per_project: number;
  mongo_per_project: number;
  cache_per_project: number;
  backend_slots: number;
  web_slots: number;
  custom_domains: number | null;
  build_minutes: number | null;
  bandwidth_bytes: number;
  api_requests_per_min: number;
  deployment_history: number | null;
}

export interface PlanDraftItem {
  plan_key: "free" | "developer" | "founder";
  display_name: string;
  price: PlanPrice | null;
  limits: PlanLimits;
  log_retention_days: number;
  backup_retention_days: number | null;
}

export interface ServiceDraftItem {
  service_key: "web" | "backend";
  service_type: "web" | "backend";
  display_name: string;
  schema_version: string;
  hard_ceiling_profile: string;
  max_functions: number;
  max_port: number | null;
  enabled: boolean;
}

export interface HostingProject extends AdminRecord {
  id: string;
  org_id: string;
  project_id: string;
  kind: "web" | "backend";
  name: string;
  desired_state: string;
  desired_version: number;
  observed_state: string;
  observed_version: number;
  sync_state: "PENDING" | "IN_SYNC" | "OUT_OF_SYNC" | "FAILED";
  route_set_version: number;
  route_observed_version: number;
  route_observed_state: "UNKNOWN" | "APPLIED" | "REMOVED" | "ERROR";
  route_observed_at: string | null;
  route_sync_state: "PENDING" | "IN_SYNC" | "FAILED";
  route_sync_error: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CustomDomain extends AdminRecord {
  id: string;
  service_id: string;
  fqdn: string;
  state: string;
  verification_method: "dns_txt" | "cname";
  ownership_state: "PENDING" | "VERIFIED" | "LOST";
  routing_state: "PENDING" | "VERIFIED" | "LOST" | "REMOVING" | "REMOVED";
  certificate_state: string;
  certificate_observed_state: string;
  certificate_renewal_due_at: string | null;
  certificate_error_code: string | null;
  last_error: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AdminRecord {
  [key: string]: unknown;
}

export interface AdminSuccessEnvelope<T> {
  success: true;
  data: T;
  request_id: string;
}

export interface AdminErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    retryable: boolean;
    documentation_url: string;
  };
  request_id: string;
}

export type AdminEnvelope<T> = AdminSuccessEnvelope<T> | AdminErrorBody;

export interface AdminMutationResult<T = AdminRecord> {
  data: T;
  request_id: string;
}

export type AdminListQuery = Record<string, string | number | boolean | undefined | null>;

export type MutationMethod = "POST" | "PATCH" | "PUT" | "DELETE";

export interface MutationInput<TBody = unknown> {
  method?: MutationMethod;
  path: string;
  body?: TBody;
  action?: string;
  step_up_action?: string;
  idempotency_key?: string;
}

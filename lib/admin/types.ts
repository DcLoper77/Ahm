export type AdminRole =
  "ROOT" | "PLATFORM_ADMIN" | "SUPPORT_OPERATOR" | "BILLING_ADMIN" | "INFRA_ADMIN" | "ANALYST";

export type AdminPermission =
  | "*"
  | "admins.read"
  | "admins.invite"
  | "users.read"
  | "users.tiers.read"
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
  | "billing.correction"
  | "databases.read"
  | "databases.write"
  | "tiers.read"
  | "tiers.write"
  | "tiers.assign"
  | "analytics.read"
  | "audit.read";

export type AdminStatus = "ACTIVE" | "DISABLED";

export interface AdminMe {
  id: string;
  email: string;
  roles: AdminRole[];
  permissions: AdminPermission[];
  assignable_roles: AdminRole[];
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

export interface TierRevision {
  id: string;
  tier_id: string;
  tier_key: string;
  revision: number;
  state: "DRAFT" | "VALIDATED" | "PUBLISHED" | "RETIRED";
  validation_sha256: string | null;
  display_name: string;
  description: string | null;
  price_usd_minor: number;
  price_inr_minor: number;
  price_kind: "FREE" | "PAID";
  grant_only: true;
  duration_days: number;
  version: number;
  created_by: string;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
}

export interface CustomTierSummary extends AdminRecord {
  id: string;
  revision_id?: string | null;
  tier_id: string;
  key: string;
  name: string;
  description: string | null;
  state: "DRAFT" | "VALIDATED" | "ACTIVE" | "ARCHIVED" | "RETIRED";
  billing_mode: "FREE" | "PAID";
  price_kind: "FREE" | "PAID";
  price_usd_minor: number;
  price_inr_minor: number;
  grant_only?: true;
  interval: "GRANT" | "MONTH";
  default_duration_days: number | null;
  enforced_limit_keys: string[];
  unenforced_limit_keys: string[];
  limits: Record<string, number | null>;
  features: string[];
  system: boolean;
  assignment_count: number;
  active_assignment_count: number;
  version: number;
  revision_version: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface TierAssignmentSummary extends AdminRecord {
  id: string;
  user_id: string;
  org_id: string;
  tier_id: string;
  tier_key: string | null;
  tier_name: string | null;
  revision_id: string;
  source: "ADMIN_GRANT";
  billing_mode: "NO_CHARGE_GRANT";
  reason: string;
  starts_at: string;
  expires_at: string;
  revoked_at: string | null;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
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

export interface CustomerFeedbackSummary {
  id: string;
  user_id: string;
  stars: number;
  message: string;
  created_at: string;
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
  backup_manual_retained: number;
  projects: number;
  team_members: number;
  store_per_project: number;
  kv_per_project: number;
  box_per_project: number;
  sql_per_project: number;
  mongo_per_project: number;
  cache_per_project: number;
  quick_databases_total: number;
  quick_databases_redis: number;
  api_requests_per_min: number;
}

export interface PlanDraftItem {
  plan_key: "free" | "developer" | "founder";
  display_name: string;
  price: PlanPrice | null;
  limits: PlanLimits;
  backup_retention_days: number | null;
}

export interface AddonDraftItem {
  addon_code: "storage_10gb" | "project_pack_10";
  display_name: string;
  price: PlanPrice;
  available_on: Array<"free" | "developer" | "founder">;
  entitlement_key: string;
  entitlement_delta: number;
  max_units: number;
}

export interface ActiveProductCatalogue {
  authority: "code" | "database";
  revision: number | null;
  plans: PlanDraftItem[];
  addons: AddonDraftItem[];
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
  money_moving?: boolean;
}

export interface CustomTierDraftBody {
  key?: string;
  name: string;
  description?: string;
  billing_mode: "FREE" | "PAID";
  price_usd_minor?: number;
  price_inr_minor?: number;
  interval: "GRANT";
  default_duration_days: number;
  limits: Record<string, number | null>;
  features: string[];
  expected_version?: number;
}

export interface TierAssignmentBody {
  org_id: string;
  tier_id: string;
  revision_id?: string;
  duration_days: number;
  expected_version: number;
  replace_active: boolean;
  reason: string;
}

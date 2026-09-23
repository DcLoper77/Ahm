import type { AdminErrorBody } from "./types";

export type AdminErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHENTICATION_FAILED"
  | "PASSWORD_RESET_INVALID"
  | "KEY_REVOKED"
  | "KEY_EXPIRED"
  | "AUTHORIZATION_DENIED"
  | "PROJECT_SUSPENDED"
  | "IP_NOT_ALLOWED"
  | "CSRF_TOKEN_INVALID"
  | "STEP_UP_REQUIRED"
  | "MFA_REQUIRED"
  | "MFA_CODE_INVALID"
  | "ADMIN_AUTHENTICATION_FAILED"
  | "ADMIN_LOGIN_THROTTLED"
  | "ADMIN_MFA_REQUIRED"
  | "ADMIN_SESSION_EXPIRED"
  | "ADMIN_PERMISSION_DENIED"
  | "ADMIN_CSRF_TOKEN_INVALID"
  | "CREDENTIAL_REVEAL_REPLAY_UNAVAILABLE"
  | "ADMIN_INVITE_INVALID"
  | "ADMIN_INVITE_EXPIRED"
  | "ADMIN_INVITE_USED"
  | "ADMIN_INVITE_ALREADY_PENDING"
  | "ADMIN_ADMIN_ALREADY_EXISTS"
  | "ADMIN_ROLE_GRANT_EXCEEDS_AUTHORITY"
  | "LAST_ROOT_REQUIRED"
  | "VALIDATION_FAILED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "ROUTE_NOT_FOUND"
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_CONFLICT"
  | "CATALOG_VERSION_CONFLICT"
  | "CATALOG_PARITY_REQUIRED"
  | "CATALOGUE_INVALID"
  | "CATALOG_ACTIVE_REVISION"
  | "CATALOG_RUNTIME_ACTIVATION_FAILED"
  | "INVALID_STATE_TRANSITION"
  | "RESOURCE_BUSY"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "CONCURRENCY_LIMIT"
  | "DEPENDENCY_UNAVAILABLE"
  | "CIRCUIT_OPEN"
  | "TIMEOUT"
  | "SERVICE_DEGRADED"
  | "DATABASE_POOL_EXHAUSTED"
  | "CONFIG_INVALID"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED"
  | "FEATURE_DISABLED"
  | "SAGA_FAILED"
  | "PAYMENT_PROVIDER_REJECTED"
  | "PAYMENT_VERIFICATION_MISMATCH"
  | "REFUND_NOT_AVAILABLE"
  | "NETWORK_ERROR"
  | "MALFORMED_RESPONSE"
  | "UPSTREAM_RESPONSE_INVALID";

const safeMessages: Record<AdminErrorCode, string> = {
  AUTHENTICATION_REQUIRED: "Sign in to continue.",
  AUTHENTICATION_FAILED: "We could not verify those credentials.",
  PASSWORD_RESET_INVALID: "That password reset is no longer valid.",
  KEY_REVOKED: "The requested key has been revoked.",
  KEY_EXPIRED: "The requested key has expired.",
  AUTHORIZATION_DENIED: "You do not have access to this action.",
  PROJECT_SUSPENDED: "This project is currently suspended.",
  IP_NOT_ALLOWED: "This request is not allowed from the current network.",
  CSRF_TOKEN_INVALID: "Your security token expired. Refresh and try again.",
  STEP_UP_REQUIRED: "Fresh MFA verification is required for this action.",
  MFA_REQUIRED: "MFA verification is required.",
  MFA_CODE_INVALID: "That MFA code could not be verified.",
  ADMIN_AUTHENTICATION_FAILED: "We could not verify those credentials.",
  ADMIN_LOGIN_THROTTLED: "Too many attempts. Try again after the displayed wait period.",
  ADMIN_MFA_REQUIRED: "Enter a current MFA code to continue.",
  ADMIN_SESSION_EXPIRED: "Your admin session expired. Sign in again to continue.",
  ADMIN_PERMISSION_DENIED: "Your current role does not allow this action.",
  ADMIN_CSRF_TOKEN_INVALID: "Your security token expired. Refresh and try again.",
  CREDENTIAL_REVEAL_REPLAY_UNAVAILABLE:
    "This one-time security value cannot be shown again. Start a fresh setup or rotation.",
  ADMIN_INVITE_INVALID: "This invitation link is not valid.",
  ADMIN_INVITE_EXPIRED: "This invitation has expired.",
  ADMIN_INVITE_USED: "This invitation has already been accepted.",
  ADMIN_INVITE_ALREADY_PENDING: "An invitation is already pending for this address.",
  ADMIN_ADMIN_ALREADY_EXISTS: "An administrator with this address already exists.",
  ADMIN_ROLE_GRANT_EXCEEDS_AUTHORITY: "Your role cannot grant that permission set.",
  LAST_ROOT_REQUIRED: "The final root path must remain active.",
  VALIDATION_FAILED: "Review the highlighted fields and try again.",
  IDEMPOTENCY_KEY_REQUIRED: "A stable action reference is required. Try the action again.",
  IDEMPOTENCY_KEY_REUSED: "This action reference was already used for another request.",
  IDEMPOTENCY_IN_PROGRESS: "The action is still being processed. We are checking its status.",
  ROUTE_NOT_FOUND: "That admin operation is not available.",
  RESOURCE_NOT_FOUND: "The requested record is unavailable or outside your scope.",
  RESOURCE_CONFLICT: "This record changed elsewhere. Refresh before trying again.",
  CATALOG_VERSION_CONFLICT: "The catalogue changed elsewhere. Refresh before trying again.",
  CATALOG_PARITY_REQUIRED: "The catalogue must pass parity verification before publication.",
  CATALOGUE_INVALID: "The catalogue draft did not pass validation.",
  CATALOG_ACTIVE_REVISION: "The active catalogue revision cannot be retired yet.",
  CATALOG_RUNTIME_ACTIVATION_FAILED:
    "The catalogue was accepted but runtime activation is delayed.",
  INVALID_STATE_TRANSITION: "This action is not available in the current state.",
  RESOURCE_BUSY: "The record is busy. Try again shortly.",
  RATE_LIMITED: "Too many requests. Try again after the displayed wait period.",
  QUOTA_EXCEEDED: "The requested value exceeds the supported quota.",
  CONCURRENCY_LIMIT: "The operation queue is at capacity. Try again shortly.",
  DEPENDENCY_UNAVAILABLE: "A dependency is unavailable. The operation may remain pending.",
  CIRCUIT_OPEN: "The dependency circuit is open. Try again after recovery.",
  TIMEOUT: "The request timed out. The same action can be retried safely.",
  SERVICE_DEGRADED: "The service is degraded. We will keep the pending state visible.",
  DATABASE_POOL_EXHAUSTED: "The database is at capacity. Try again shortly.",
  CONFIG_INVALID: "The service configuration is invalid.",
  INTERNAL_ERROR: "The service could not complete the request.",
  NOT_IMPLEMENTED: "This operation is not available.",
  FEATURE_DISABLED: "This operation is currently disabled.",
  SAGA_FAILED: "The operation reached a terminal failure. Review its audit evidence.",
  PAYMENT_PROVIDER_REJECTED:
    "The payment correction could not be completed. Review the current payment status before trying again.",
  PAYMENT_VERIFICATION_MISMATCH:
    "The payment evidence did not match the stored record. Review the payment status.",
  REFUND_NOT_AVAILABLE: "This billing correction is unavailable under the current policy.",
  NETWORK_ERROR: "The admin service could not be reached. Check the connection and try again.",
  MALFORMED_RESPONSE:
    "The admin service returned an unreadable response. Retry or contact the operator with the request ID.",
  UPSTREAM_RESPONSE_INVALID:
    "The upstream response could not be trusted; no automatic repeat was made.",
};

const retryableCodes = new Set<AdminErrorCode>([
  "ADMIN_LOGIN_THROTTLED",
  "IDEMPOTENCY_IN_PROGRESS",
  "RESOURCE_BUSY",
  "RATE_LIMITED",
  "CONCURRENCY_LIMIT",
  "DEPENDENCY_UNAVAILABLE",
  "CIRCUIT_OPEN",
  "TIMEOUT",
  "NETWORK_ERROR",
  "SERVICE_DEGRADED",
  "DATABASE_POOL_EXHAUSTED",
  "INTERNAL_ERROR",
  "CATALOG_RUNTIME_ACTIVATION_FAILED",
]);

export interface ValidationIssue {
  path?: string[];
  message?: string;
  code?: string;
}

export class AdminApiError extends Error {
  readonly code: AdminErrorCode | string;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: unknown;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly idempotencyKey?: string;
  readonly documentationUrl?: string;

  constructor(options: {
    code: AdminErrorCode | string;
    status: number;
    requestId?: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
    idempotencyKey?: string;
    documentationUrl?: string;
    message?: string;
  }) {
    super(options.message ?? safeMessageForCode(options.code));
    this.name = "AdminApiError";
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.details = options.details;
    this.retryable = options.retryable ?? isRetryableCode(options.code);
    this.retryAfterMs = options.retryAfterMs;
    this.idempotencyKey = options.idempotencyKey;
    this.documentationUrl = options.documentationUrl;
  }
}

export function safeMessageForCode(code: string): string {
  return (
    safeMessages[code as AdminErrorCode] ?? "The admin service could not complete the request."
  );
}

export function isRetryableCode(code: string): boolean {
  return retryableCodes.has(code as AdminErrorCode);
}

export function isSessionExpiredError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError && error.code === "ADMIN_SESSION_EXPIRED";
}

export function isPermissionDeniedError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError && error.code === "ADMIN_PERMISSION_DENIED";
}

export function isStepUpRequiredError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError && error.code === "STEP_UP_REQUIRED";
}

export function isMfaRequiredError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError && error.code === "ADMIN_MFA_REQUIRED";
}

export function getValidationIssues(error: unknown): ValidationIssue[] {
  if (!(error instanceof AdminApiError) || !error.details || typeof error.details !== "object") {
    return [];
  }

  const details = error.details as { issues?: unknown };
  return Array.isArray(details.issues) ? (details.issues as ValidationIssue[]) : [];
}

export function errorFromEnvelope(
  envelope: AdminErrorBody,
  status: number,
  options?: { retryAfterMs?: number; idempotencyKey?: string },
): AdminApiError {
  return new AdminApiError({
    code: envelope.error.code,
    message: safeMessageForCode(envelope.error.code),
    status,
    requestId: envelope.request_id,
    details: envelope.error.details,
    retryable: envelope.error.retryable,
    retryAfterMs: options?.retryAfterMs,
    idempotencyKey: options?.idempotencyKey,
    documentationUrl: envelope.error.documentation_url,
  });
}

export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

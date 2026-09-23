import type { AdminPermission, AdminRole } from "./types";

/** Effective permissions come from the authenticated backend session. The frontend never duplicates
 * the role matrix that the backend uses to authorize a request. */
export function hasPermission(
  permissions: readonly AdminPermission[],
  permission: AdminPermission,
): boolean {
  return permissions.includes("*") || permissions.includes(permission);
}

export function hasAnyPermission(
  permissions: readonly AdminPermission[],
  required: readonly AdminPermission[],
): boolean {
  return required.some((permission) => hasPermission(permissions, permission));
}

export function canGrantRole(
  assignableRoles: readonly AdminRole[],
  targetRole: AdminRole,
): boolean {
  return assignableRoles.includes(targetRole);
}

export function roleLabel(role: AdminRole): string {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function roleSummary(roles: readonly AdminRole[]): string {
  return roles.map(roleLabel).join(" · ");
}

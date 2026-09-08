import type { AdminPermission, AdminRole } from "./types";

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  ROOT: ["*"],
  PLATFORM_ADMIN: [
    "admins.read",
    "admins.invite",
    "users.read",
    "orgs.read",
    "catalog.read",
    "catalog.write",
    "system.read",
    "system.write",
    "quotas.read",
    "quotas.write",
  ],
  SUPPORT_OPERATOR: [
    "users.read",
    "orgs.read",
    "users.suspend",
    "orgs.suspend",
    "catalog.read",
    "quotas.read",
    "quotas.write",
  ],
  BILLING_ADMIN: [
    "users.read",
    "orgs.read",
    "billing.read",
    "billing.write",
    "catalog.read",
    "catalog.write",
    "quotas.read",
  ],
  INFRA_ADMIN: [
    "users.read",
    "orgs.read",
    "hosting.read",
    "hosting.write",
    "domains.read",
    "domains.write",
    "databases.read",
    "databases.write",
    "vps.read",
    "vps.write",
    "catalog.read",
  ],
  ANALYST: ["analytics.read", "audit.read", "catalog.read"],
};

export function permissionsForRoles(roles: readonly AdminRole[]): Set<AdminPermission> {
  const permissions = new Set<AdminPermission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) permissions.add(permission);
  }
  return permissions;
}

export function hasPermission(roles: readonly AdminRole[], permission: AdminPermission): boolean {
  const permissions = permissionsForRoles(roles);
  return permissions.has("*") || permissions.has(permission);
}

export function hasAnyPermission(
  roles: readonly AdminRole[],
  permissions: readonly AdminPermission[],
): boolean {
  return permissions.some((permission) => hasPermission(roles, permission));
}

export function canGrantRole(grantorRoles: readonly AdminRole[], targetRole: AdminRole): boolean {
  return (ROLE_PERMISSIONS[targetRole] ?? []).every((permission) =>
    hasPermission(grantorRoles, permission),
  );
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

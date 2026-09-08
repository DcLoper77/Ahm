import type { IconName } from "@/components/icons";
import type { AdminPermission } from "./types";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: IconName;
  permissions: AdminPermission[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Command center",
    items: [
      {
        href: "/",
        label: "Overview",
        description: "System readiness and operating picture",
        icon: "spark",
        permissions: ["analytics.read", "system.read"],
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        href: "/users",
        label: "Users",
        description: "Customer identity and account state",
        icon: "users",
        permissions: ["users.read"],
      },
      {
        href: "/organizations",
        label: "Organizations",
        description: "Ownership, services, and billing state",
        icon: "building",
        permissions: ["orgs.read"],
      },
    ],
  },
  {
    label: "Catalogue",
    items: [
      {
        href: "/catalogue",
        label: "Plans & services",
        description: "Immutable revisions and parity",
        icon: "layers",
        permissions: ["catalog.read"],
      },
      {
        href: "/quotas",
        label: "Quotas",
        description: "Typed organization overrides",
        icon: "sliders",
        permissions: ["quotas.read"],
      },
      {
        href: "/features",
        label: "Feature flags",
        description: "Closed global product switches",
        icon: "check-circle",
        permissions: ["catalog.read"],
      },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      {
        href: "/hosting",
        label: "Hosting",
        description: "Desired, observed, and deployments",
        icon: "server",
        permissions: ["hosting.read"],
      },
      {
        href: "/deployments",
        label: "Deployments",
        description: "Build and retained-release evidence",
        icon: "activity",
        permissions: ["hosting.read"],
      },
      {
        href: "/domains",
        label: "Domains",
        description: "Ownership, routing, and certificates",
        icon: "globe",
        permissions: ["domains.read"],
      },
      {
        href: "/databases",
        label: "Databases",
        description: "Safe connection and failure projections",
        icon: "database",
        permissions: ["databases.read"],
      },
      {
        href: "/vps",
        label: "HavenVPS",
        description: "Instance and AIC observations",
        icon: "cpu",
        permissions: ["vps.read"],
      },
    ],
  },
  {
    label: "Billing",
    items: [
      {
        href: "/billing/subscriptions",
        label: "Subscriptions",
        description: "Plan lifecycle and periods",
        icon: "credit-card",
        permissions: ["billing.read"],
      },
      {
        href: "/billing/invoices",
        label: "Invoices",
        description: "Immutable billing documents",
        icon: "receipt",
        permissions: ["billing.read"],
      },
      {
        href: "/billing/payments",
        label: "Payments & refunds",
        description: "Attempts, failures, and money movement",
        icon: "arrow-up-right",
        permissions: ["billing.read"],
      },
    ],
  },
  {
    label: "Control",
    items: [
      {
        href: "/admins",
        label: "Administrators",
        description: "Roles, invitations, and status",
        icon: "shield",
        permissions: ["admins.read"],
      },
      {
        href: "/audit",
        label: "Audit log",
        description: "Redacted hash-chain evidence",
        icon: "activity",
        permissions: ["audit.read"],
      },
      {
        href: "/system",
        label: "Operations",
        description: "Health, jobs, outbox, and quarantine",
        icon: "pulse",
        permissions: ["system.read"],
      },
      {
        href: "/settings/sessions",
        label: "Security",
        description: "Your MFA and active sessions",
        icon: "lock",
        permissions: ["admins.read", "users.read", "orgs.read", "catalog.read", "analytics.read"],
      },
    ],
  },
];

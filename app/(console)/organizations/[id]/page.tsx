"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { useAdminQuery } from "@/lib/admin/hooks";
import { useAdminSession } from "@/components/auth/session-context";
import { ConfirmActionModal } from "@/components/confirm-action";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import { AuditRef, RecordFacts, SafeRecordSummary } from "@/components/record-view";
import { formatBytes, formatDate, humanize } from "@/lib/admin/format";
import { Badge, Button, Card, PageHeader, StatCard, StatusBadge } from "@/components/ui";

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { admin, runMutation } = useAdminSession();
  const canRead = hasPermission(admin?.permissions ?? [], "orgs.read");
  const canMutate = hasPermission(admin?.permissions ?? [], "orgs.suspend");
  const query = useAdminQuery(
    ["organization", params.id],
    (api) => api.organizations.detail(params.id),
    { enabled: canRead },
  );
  const canAnalytics = hasPermission(admin?.permissions ?? [], "analytics.read");
  const usageQuery = useAdminQuery(
    ["organization-usage", params.id],
    (api) => api.analytics.organizationUsage(params.id),
    { enabled: canAnalytics },
  );
  const [action, setAction] = useState<"suspend" | "restore" | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const organization = query.data?.data.org;
  const rawUsage = usageQuery.data?.data.organization;
  const usage =
    rawUsage && typeof rawUsage === "object" && !Array.isArray(rawUsage)
      ? (rawUsage as Record<string, unknown>)
      : undefined;
  const storage =
    usage?.storage && typeof usage.storage === "object" && !Array.isArray(usage.storage)
      ? (usage.storage as Record<string, unknown>)
      : undefined;
  const usageMetrics = Array.isArray(storage?.by_metric) ? storage.by_metric : [];
  const primaryMetric =
    usageMetrics[0] && typeof usageMetrics[0] === "object"
      ? (usageMetrics[0] as Record<string, unknown>)
      : undefined;

  const submit = async (input: { reason?: string; expected_version?: number }) => {
    if (!organization || !action) return;
    if (input.expected_version === undefined) {
      throw new Error("The current organization version is unavailable. Refresh before retrying.");
    }
    const response = await runMutation<Record<string, unknown>>({
      path: `/orgs/${encodeURIComponent(params.id)}:${action}`,
      body: {
        reason: input.reason ?? "",
        expected_version: input.expected_version,
      },
      step_up_action: `admin:org_${action}`,
    });
    setRequestId(response.request_id);
    setAction(null);
    await queryClient.invalidateQueries({ queryKey: ["organization", params.id] });
    await queryClient.invalidateQueries({ queryKey: ["organizations"] });
  };

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Customers" title="Organization detail" />
        <QueryEmpty
          title="Permission required"
          description="Ask a platform administrator for orgs.read to inspect this record."
        />
      </>
    );
  if (query.isLoading)
    return (
      <>
        <PageHeader eyebrow="Customers" title="Organization detail" />
        <QueryLoading label="Loading organization detail…" />
      </>
    );
  if (query.error)
    return (
      <>
        <PageHeader eyebrow="Customers" title="Organization detail" />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  if (!organization)
    return (
      <>
        <PageHeader eyebrow="Customers" title="Organization detail" />
        <QueryEmpty
          title="Organization unavailable"
          description="The record is absent or outside your role scope."
        />
      </>
    );

  const name = typeof organization.name === "string" ? organization.name : params.id;
  const currentVersion =
    typeof organization.version === "number" && organization.version >= 1
      ? organization.version
      : undefined;
  const serviceState = organization.service_state ?? organization.state;
  const billingProjection = organization.billing;
  const billingState =
    organization.billing_state ??
    (billingProjection && typeof billingProjection === "object" && "status" in billingProjection
      ? (billingProjection as { status?: unknown }).status
      : undefined);
  return (
    <>
      <PageHeader
        eyebrow="Customers / Organizations"
        title={name}
        description="Service, billing, ownership, and aggregate state stay visibly separate."
        actions={
          <>
            <Button
              variant="quiet"
              icon="chevron-left"
              onClick={() => router.push("/organizations")}
            >
              Back to organizations
            </Button>
            {canMutate &&
              currentVersion !== undefined &&
              (serviceState === "SUSPENDED" ? (
                <Button variant="secondary" icon="play" onClick={() => setAction("restore")}>
                  Restore services
                </Button>
              ) : (
                <Button variant="danger-quiet" icon="pause" onClick={() => setAction("suspend")}>
                  Suspend services
                </Button>
              ))}
            {canMutate && currentVersion === undefined ? (
              <Badge tone="warning">Waiting for current version</Badge>
            ) : null}
          </>
        }
      />
      {requestId ? (
        <Card className="result-card">
          <div className="card-heading">
            <div>
              <h2>Service action accepted</h2>
              <p>Database effects converge asynchronously; billing state is unchanged.</p>
            </div>
            <AuditRef requestId={requestId} />
          </div>
        </Card>
      ) : null}
      <Card>
        <div className="card-heading">
          <div>
            <h2>Organization usage</h2>
            <p>Bounded counts and sampled storage observations from the analytics projection.</p>
          </div>
          <Badge tone="neutral">
            {canAnalytics ? "Analytics projection" : "Analytics access required"}
          </Badge>
        </div>
        {!canAnalytics ? (
          <QueryEmpty
            title="Permission required"
            description="Ask for analytics.read to inspect organization usage."
          />
        ) : usageQuery.isLoading ? (
          <QueryLoading label="Loading organization usage…" />
        ) : usageQuery.error ? (
          <QueryError error={usageQuery.error} onRetry={() => void usageQuery.refetch()} />
        ) : usage ? (
          <>
            <div className="stat-grid">
              <StatCard
                label="Members"
                value={String(usage.members ?? "—")}
                icon="users"
                tone="blue"
              />
              <StatCard
                label="Projects"
                value={String(usage.projects ?? "—")}
                icon="spark"
                tone="green"
              />
              <StatCard
                label="Project databases"
                value={String(usage.databases ?? "—")}
                icon="database"
                tone="blue"
              />
              <StatCard
                label="Observed storage"
                value={formatBytes(storage?.total_bytes)}
                detail={humanize(primaryMetric?.confidence ?? "not reported")}
                icon="layers"
                tone="amber"
              />
            </div>
            <p className="security-note">
              Sampled at {formatDate(storage?.sampled_at)}. A missing sample is not shown as zero.
            </p>
          </>
        ) : (
          <QueryEmpty
            title="No usage observation"
            description="The analytics projection returned no organization usage record."
          />
        )}
      </Card>
      <div className="detail-grid">
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Organization state</h2>
                <p>Current service and billing projections from the admin API.</p>
              </div>
              <StatusBadge value={serviceState ?? "UNKNOWN"} />
            </div>
            <div className="detail-section">
              <RecordFacts
                record={organization}
                fields={[
                  { key: "id", label: "Organization ID", kind: "id" },
                  { key: "kind", label: "Kind" },
                  { key: "plan_code", label: "Plan" },
                  { key: "state", label: "Organization state", kind: "status" },
                  { key: "billing_state", label: "Billing state", kind: "status" },
                  { key: "version", label: "Version" },
                  { key: "created_at", label: "Created", kind: "date" },
                  { key: "updated_at", label: "Updated", kind: "date" },
                ]}
              />
            </div>
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <h2>Ownership & aggregates</h2>
                <p>Safe relationships and counts returned by the detail projection.</p>
              </div>
            </div>
            <div className="detail-section">
              <RecordFacts
                record={organization}
                fields={[
                  { key: "owner_user_id", label: "Owner user", kind: "id" },
                  { key: "aggregates.member_count", label: "Members" },
                  { key: "aggregates.project_count", label: "Projects" },
                  { key: "aggregates.resource_count", label: "Resources" },
                ]}
              />
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Billing boundary</h2>
                <p>Administrative suspension does not mutate billing status.</p>
              </div>
              <Badge tone="info" icon="credit-card">
                Separate state
              </Badge>
            </div>
            <div className="detail-section">
              <p className="security-note">
                Service suspension creates durable database effects. Subscription, invoices, and
                payment records remain in their own billing lifecycle.
              </p>
              <div className="detail-rows" style={{ marginTop: 12 }}>
                <div className="detail-row">
                  <dt>Billing state</dt>
                  <dd>
                    <StatusBadge value={billingState ?? "Not reported"} />
                  </dd>
                </div>
                <div className="detail-row">
                  <dt>Plan</dt>
                  <dd>
                    {typeof organization.plan_code === "string"
                      ? organization.plan_code
                      : "Not reported"}
                  </dd>
                </div>
              </div>
              <Link
                href={`/billing/subscriptions?org_id=${encodeURIComponent(params.id)}`}
                className="button button-quiet"
                style={{ marginTop: 10 }}
              >
                Open billing records <span>→</span>
              </Link>
            </div>
          </Card>
          <SafeRecordSummary
            record={organization}
            exclude={["id", "name", "slug", "service_state", "billing_state", "billing"]}
          />
        </div>
      </div>
      {action ? (
        <ConfirmActionModal
          title={
            action === "suspend" ? "Suspend organization services" : "Restore organization services"
          }
          target={name}
          description={
            action === "suspend"
              ? "This creates durable database effects while leaving billing state unchanged."
              : "This restores services through the guarded organization transition."
          }
          actionLabel={action === "suspend" ? "Suspend services" : "Restore services"}
          dangerous={action === "suspend"}
          expectedVersion={currentVersion}
          onConfirm={submit}
          onClose={() => setAction(null)}
        />
      ) : null}
    </>
  );
}

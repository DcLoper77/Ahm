"use client";

import { useQueryClient } from "@tanstack/react-query";
import { formatDate, humanize, isSensitiveKey, safeScalar } from "@/lib/admin/format";
import { hasPermission } from "@/lib/admin/rbac";
import { useAdminSession } from "@/components/auth/session-context";
import { useAdminQuery } from "@/lib/admin/hooks";
import { QueryError, QueryLoading } from "@/components/data-states";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InlineAlert,
  PageHeader,
  Skeleton,
  StatCard,
  StatusBadge,
} from "@/components/ui";

const metricCandidates = {
  users: ["total_users", "users_total", "user_count", "users"],
  organizations: ["total_orgs", "orgs_total", "organization_count", "organizations"],
  hosting: ["hosting_projects", "hosting_project_count", "active_services", "services"],
  failures: ["failed_resources", "failure_count", "billing_failures", "payment_failures"],
};

function scalarAt(data: unknown, names: string[]): string | number | boolean | null {
  if (!data || typeof data !== "object") return null;
  for (const name of names) {
    const value = (data as Record<string, unknown>)[name];
    const scalar = safeScalar(value);
    if (scalar !== null) return scalar;
  }
  return null;
}

function displayMetric(value: string | number | boolean | null): string {
  return value === null ? "—" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
}

function safeSignals(data: unknown): { key: string; value: string | number | boolean }[] {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data as Record<string, unknown>)
    .filter(([key, value]) => !isSensitiveKey(key) && safeScalar(value) !== null)
    .slice(0, 10)
    .map(([key, value]) => ({ key, value: safeScalar(value) as string | number | boolean }));
}

function HealthCard({
  data,
  loading,
  error,
  onRetry,
}: {
  data: unknown;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (loading) return <QueryLoading label="Reading system health…" />;
  if (error) return <QueryError error={error} onRetry={onRetry} />;
  const signals = safeSignals(data);
  const statusValue = scalarAt(data, ["status", "readiness", "overall_status"]);
  return (
    <Card>
      <div className="card-heading">
        <div>
          <p className="eyebrow">Readiness</p>
          <h2>System health</h2>
          <p>Dependency, worker, queue, and audit-chain observations.</p>
        </div>
        <StatusBadge
          value={statusValue ?? "UNKNOWN"}
          label={statusValue ? humanize(statusValue) : "Awaiting observation"}
        />
      </div>
      {signals.length ? (
        <div className="health-signal-grid">
          {signals.map((signal) => (
            <div className="health-signal" key={signal.key}>
              <span>{humanize(signal.key)}</span>
              <strong>{String(signal.value)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="pulse"
          title="No health projection yet"
          description="The API did not return safe scalar health signals. Stale or degraded states remain visible when reported."
        />
      )}
    </Card>
  );
}

function ActivityCard({
  audit,
  loading,
  error,
  onRetry,
}: {
  audit: unknown;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const rows =
    audit && typeof audit === "object" && Array.isArray((audit as { audit?: unknown }).audit)
      ? (audit as { audit: unknown[] }).audit.slice(0, 5)
      : [];
  return (
    <Card>
      <div className="card-heading">
        <div>
          <p className="eyebrow">Evidence</p>
          <h2>Recent activity</h2>
          <p>Redacted administrative events from the audit projection.</p>
        </div>
        <Badge tone="info" icon="shield">
          Hash-chain
        </Badge>
      </div>
      {loading ? (
        <div className="activity-loading">
          <Skeleton className="activity-skeleton" />
          <Skeleton className="activity-skeleton" />
          <Skeleton className="activity-skeleton" />
        </div>
      ) : error ? (
        <QueryError error={error} onRetry={onRetry} />
      ) : rows.length ? (
        <div className="activity-list detail-section">
          {rows.map((row, index) => {
            const item = row as Record<string, unknown>;
            return (
              <div className="activity-item" key={String(item.id ?? item.seq ?? index)}>
                <span className="activity-dot" />
                <div className="activity-copy">
                  <strong>{humanize(item.action ?? "Administrative event")}</strong>
                  <span>
                    {humanize(item.outcome ?? "Recorded")}{" "}
                    {typeof item.target_type === "string" ? `· ${humanize(item.target_type)}` : ""}
                  </span>
                  <time>{formatDate(item.created_at ?? item.occurred_at)}</time>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="activity"
          title="No activity in this window"
          description="Audit records will appear here after the admin projection reports them."
        />
      )}
    </Card>
  );
}

export default function OverviewPage() {
  const { admin, status } = useAdminSession();
  const queryClient = useQueryClient();
  const canAnalytics = hasPermission(admin?.roles ?? [], "analytics.read");
  const canSystem = hasPermission(admin?.roles ?? [], "system.read");
  const canAudit = hasPermission(admin?.roles ?? [], "audit.read");
  const usage = useAdminQuery(["usage"], (resourceApi) => resourceApi.analytics.usage(), {
    enabled: canAnalytics,
  });
  const health = useAdminQuery(["system", "health"], (resourceApi) => resourceApi.system.health(), {
    enabled: canSystem,
    refetchInterval: 60_000,
  });
  const activity = useAdminQuery(
    ["audit", "recent"],
    (resourceApi) => resourceApi.audit.list({ limit: 5, sort_by: "seq", sort_order: "desc" }),
    { enabled: canAudit },
  );

  const usageData = usage.data?.data;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["usage"] });
    void queryClient.invalidateQueries({ queryKey: ["system", "health"] });
    void queryClient.invalidateQueries({ queryKey: ["audit", "recent"] });
  };

  if (status === "loading")
    return (
      <>
        <PageHeader
          eyebrow="Command center"
          title="Overview"
          description="Loading the administrative operating picture."
        />
        <div className="stat-grid">
          {[1, 2, 3, 4].map((item) => (
            <Card className="stat-card" key={item}>
              <Skeleton className="stat-skeleton-icon" />
              <Skeleton className="stat-skeleton-copy" />
            </Card>
          ))}
        </div>
      </>
    );

  return (
    <>
      <PageHeader
        eyebrow="Command center"
        title="Overview"
        description="A measured view of platform readiness, customer state, and the work still converging."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={refresh}
            loading={usage.isFetching || health.isFetching || activity.isFetching}
          >
            Refresh data
          </Button>
        }
      />
      {!canAnalytics ? <Badge tone="neutral">Analytics is not included in your role.</Badge> : null}
      {usage.error && canAnalytics ? (
        <InlineAlert tone="danger" title="Usage projection unavailable">
          The bounded usage projection could not be loaded. Other views remain available.
        </InlineAlert>
      ) : null}
      <div className="stat-grid">
        <StatCard
          label="Customer users"
          value={
            usage.isLoading ? (
              <Skeleton className="stat-value-skeleton" />
            ) : (
              displayMetric(scalarAt(usageData, metricCandidates.users))
            )
          }
          detail={canAnalytics ? "From bounded usage projection" : "Analytics access required"}
          icon="users"
          tone="blue"
          href={hasPermission(admin?.roles ?? [], "users.read") ? "/users" : undefined}
        />
        <StatCard
          label="Organizations"
          value={
            usage.isLoading ? (
              <Skeleton className="stat-value-skeleton" />
            ) : (
              displayMetric(scalarAt(usageData, metricCandidates.organizations))
            )
          }
          detail="Role-minimized aggregate"
          icon="building"
          tone="green"
          href={hasPermission(admin?.roles ?? [], "orgs.read") ? "/organizations" : undefined}
        />
        <StatCard
          label="Hosting resources"
          value={
            usage.isLoading ? (
              <Skeleton className="stat-value-skeleton" />
            ) : (
              displayMetric(scalarAt(usageData, metricCandidates.hosting))
            )
          }
          detail="Desired and observed state"
          icon="server"
          tone="blue"
          href={hasPermission(admin?.roles ?? [], "hosting.read") ? "/hosting" : undefined}
        />
        <StatCard
          label="Failure signals"
          value={
            usage.isLoading ? (
              <Skeleton className="stat-value-skeleton" />
            ) : (
              displayMetric(scalarAt(usageData, metricCandidates.failures))
            )
          }
          detail="Reported by the admin projection"
          icon="alert"
          tone="red"
          href={hasPermission(admin?.roles ?? [], "audit.read") ? "/audit" : undefined}
        />
      </div>
      <div className="dashboard-grid">
        <div className="stack">
          <HealthCard
            data={health.data?.data}
            loading={health.isLoading}
            error={health.error}
            onRetry={() => void health.refetch()}
          />
          <ActivityCard
            audit={activity.data?.data}
            loading={activity.isLoading}
            error={activity.error}
            onRetry={() => void activity.refetch()}
          />
        </div>
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <p className="eyebrow">Operating principle</p>
                <h2>Durable intent first</h2>
                <p>
                  Mutations are accepted by the local control plane and then converge through jobs,
                  outbox, and reconciliation.
                </p>
              </div>
            </div>
            <div className="detail-section">
              <div className="activity-list">
                <div className="activity-item">
                  <span className="activity-dot" />
                  <div className="activity-copy">
                    <strong>Request accepted</strong>
                    <span>Target and reason are recorded.</span>
                  </div>
                </div>
                <div className="activity-item">
                  <span className="activity-dot" />
                  <div className="activity-copy">
                    <strong>Projection converges</strong>
                    <span>Desired and observed state become aligned.</span>
                  </div>
                </div>
                <div className="activity-item">
                  <span className="activity-dot" />
                  <div className="activity-copy">
                    <strong>Audit remains attached</strong>
                    <span>Request and outcome stay discoverable.</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <p className="eyebrow">Data confidence</p>
                <h2>Use the observation, not the assumption</h2>
                <p>
                  Stale and sampled values retain their confidence label throughout the console.
                </p>
              </div>
            </div>
            <div className="confidence-list">
              <div>
                <span className="confidence-swatch confidence-swatch-green" />
                <span>
                  <strong>Exact</strong>
                  <small>Directly observed by the current projection.</small>
                </span>
              </div>
              <div>
                <span className="confidence-swatch confidence-swatch-amber" />
                <span>
                  <strong>Sampled</strong>
                  <small>Measured from a bounded observation window.</small>
                </span>
              </div>
              <div>
                <span className="confidence-swatch confidence-swatch-gray" />
                <span>
                  <strong>Stale</strong>
                  <small>Older evidence, still visible until refreshed.</small>
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

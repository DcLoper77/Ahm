"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AuditRef, SafeRecordSummary } from "@/components/record-view";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import {
  Badge,
  Button,
  Card,
  CursorPagination,
  DataTable,
  Field,
  InlineAlert,
  PageHeader,
  SelectInput,
  StatusBadge,
  TextInput,
  type TableColumn,
} from "@/components/ui";
import { useAdminSession } from "@/components/auth/session-context";
import { formatBytes, humanize } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { hasPermission } from "@/lib/admin/rbac";
import type { AdminListQuery, AdminRecord } from "@/lib/admin/types";

const quickStates = ["PENDING", "PROVISIONING", "READY", "FAILED", "DELETING", "DELETED", "LOST"];

export function QuickDatabaseListPage() {
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "databases.read");
  const [draft, setDraft] = useState({ org_id: "", kind: "", state: "", sort_order: "desc" });
  const [filters, setFilters] = useState(draft);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const query = useAdminQuery(
    ["quick-databases", filters, cursor],
    (api) => api.quickDatabases.list({ ...filters, cursor, limit: 25 } as AdminListQuery),
    { enabled: canRead },
  );
  const rows = query.data?.data.quick_databases ?? [];
  const quota = query.data?.data.quota;
  const redisOverage =
    quota?.redis_overage && typeof quota.redis_overage === "object"
      ? (quota.redis_overage as AdminRecord)
      : null;
  const quotaLabel = (value: unknown) =>
    value === -1 ? "Unlimited" : typeof value === "number" ? String(value) : "Not reported";
  const nextCursor = query.data?.data.next_cursor ?? null;
  const columns: TableColumn<AdminRecord>[] = [
    {
      key: "database",
      label: "Quick Database",
      render: (row) => (
        <Link
          href={`/quick-databases/${encodeURIComponent(String(row.id ?? ""))}`}
          className="primary-cell"
        >
          <span className="row-avatar">QD</span>
          <span className="primary-cell-copy">
            <strong>{String(row.name ?? row.id ?? "Unknown database")}</strong>
            <small className="mono">{String(row.id ?? "")}</small>
          </span>
        </Link>
      ),
    },
    {
      key: "kind",
      label: "Engine",
      render: (row) => <Badge tone="neutral">{humanize(row.kind ?? "unknown")}</Badge>,
    },
    {
      key: "state",
      label: "State",
      render: (row) => <StatusBadge value={row.state ?? "UNKNOWN"} />,
    },
    {
      key: "org",
      label: "Organization",
      render: (row) => <span className="mono">{String(row.org_id ?? "—")}</span>,
    },
    {
      key: "access",
      label: "Access",
      render: (row) => (
        <StatusBadge value={row.access_mode ?? row.freeze_state ?? "NOT REPORTED"} />
      ),
    },
    {
      key: "usage",
      label: "Observed usage",
      align: "right",
      render: (row) =>
        typeof row.size_bytes === "string" ? formatBytes(Number(row.size_bytes)) : "Not reported",
    },
  ];

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Data products" title="Quick Databases" />
        <QueryEmpty
          title="Permission required"
          description="Your admin role does not include databases.read."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Data products"
        title="Quick Databases"
        description="Organization-owned databases with safe lifecycle, access, and nullable usage observations."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["quick-databases"] })}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />
      <Card>
        <form
          className="filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters({ ...draft });
            setCursorStack([undefined]);
          }}
        >
          <Field label="Organization ID">
            <TextInput
              value={draft.org_id}
              onChange={(event) => setDraft((value) => ({ ...value, org_id: event.target.value }))}
              placeholder="Optional org_…"
            />
          </Field>
          <Field label="Engine">
            <SelectInput
              value={draft.kind}
              onChange={(event) => setDraft((value) => ({ ...value, kind: event.target.value }))}
            >
              <option value="">All engines</option>
              <option value="mysql">MySQL</option>
              <option value="mongo">MongoDB</option>
              <option value="redis">Redis</option>
            </SelectInput>
          </Field>
          <Field label="State">
            <SelectInput
              value={draft.state}
              onChange={(event) => setDraft((value) => ({ ...value, state: event.target.value }))}
            >
              <option value="">All states</option>
              {quickStates.map((state) => (
                <option key={state} value={state}>
                  {humanize(state)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="filter-actions">
            <Button type="submit" variant="primary">
              Apply
            </Button>
            <Button
              type="button"
              variant="quiet"
              onClick={() => {
                const next = { org_id: "", kind: "", state: "", sort_order: "desc" };
                setDraft(next);
                setFilters(next);
                setCursorStack([undefined]);
              }}
            >
              Clear
            </Button>
          </div>
        </form>
        {quota ? (
          <div className="detail-section">
            <div className="card-heading">
              <div>
                <h2>Organization quota</h2>
                <p>Shown for the organization selected in the filter.</p>
              </div>
              {redisOverage ? (
                <Badge tone="warning">Redis overage</Badge>
              ) : (
                <Badge tone="neutral">Current usage</Badge>
              )}
            </div>
            <div className="metric-bar">
              <div className="metric-bar-item">
                <span>Quick Databases</span>
                <strong>
                  {quotaLabel(quota.total_count)} / {quotaLabel(quota.total_limit)}
                </strong>
              </div>
              <div className="metric-bar-item">
                <span>Redis Quick Databases</span>
                <strong>
                  {quotaLabel(quota.redis_count)} / {quotaLabel(quota.redis_limit)}
                </strong>
              </div>
            </div>
            {redisOverage ? (
              <InlineAlert
                tone="warning"
                title="Redis quota overage"
              >{`Observed ${quotaLabel(redisOverage.observed_count)} Redis databases against a limit of ${quotaLabel(redisOverage.limit)}.`}</InlineAlert>
            ) : null}
          </div>
        ) : null}
        {query.isLoading ? (
          <QueryLoading label="Loading Quick Databases…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length ? (
          <>
            <DataTable
              caption="Quick Databases"
              rows={rows}
              rowKey={(row) => String(row.id)}
              columns={columns}
            />
            <div className="table-footer">
              <CursorPagination
                hasNext={Boolean(nextCursor)}
                canBack={cursorStack.length > 1}
                onNext={() => nextCursor && setCursorStack((current) => [...current, nextCursor])}
                onBack={() =>
                  setCursorStack((current) => (current.length > 1 ? current.slice(0, -1) : current))
                }
                label="Quick Databases"
              />
            </div>
          </>
        ) : (
          <QueryEmpty
            title="No Quick Databases"
            description="No records matched these filters. This is a successful empty result."
          />
        )}
      </Card>
    </>
  );
}

export function QuickDatabaseDetailPage({ id }: { id: string }) {
  const { admin } = useAdminSession();
  const canRead = hasPermission(admin?.permissions ?? [], "databases.read");
  const query = useAdminQuery(["quick-database", id], (api) => api.quickDatabases.detail(id), {
    enabled: canRead,
  });
  const record = query.data?.data.quick_database;
  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Data products" title="Quick Database" />
        <QueryEmpty
          title="Permission required"
          description="Your admin role does not include databases.read."
        />
      </>
    );
  if (query.isLoading)
    return (
      <>
        <PageHeader eyebrow="Data products" title="Quick Database" />
        <QueryLoading label="Loading Quick Database projection…" />
      </>
    );
  if (query.error)
    return (
      <>
        <PageHeader eyebrow="Data products" title="Quick Database" />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  if (!record)
    return (
      <>
        <PageHeader eyebrow="Data products" title="Quick Database" />
        <QueryEmpty
          title="Quick Database unavailable"
          description="No record was returned for this ID."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Data products / Quick Databases"
        title={String(record.name ?? id)}
        description="Connection URLs, credentials, and raw payloads are not part of this admin projection."
        actions={<StatusBadge value={record.state ?? "UNKNOWN"} />}
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Lifecycle and observations</h2>
            <p>Missing usage observations remain explicitly nullable.</p>
          </div>
          <Badge tone="neutral">Read only</Badge>
        </div>
        <SafeRecordSummary record={record} />
        <AuditRef requestId={query.data?.request_id} auditId={record.audit_id} />
      </Card>
    </>
  );
}

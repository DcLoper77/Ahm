"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmActionModal } from "@/components/confirm-action";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import { AuditRef, SafeRecordSummary } from "@/components/record-view";
import {
  Badge,
  Button,
  Card,
  CursorPagination,
  DataTable,
  Field,
  PageHeader,
  SelectInput,
  StatusBadge,
  TableColumn,
  TextInput,
} from "@/components/ui";
import { useAdminSession } from "@/components/auth/session-context";
import { formatBytes, formatDate, humanize } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { hasPermission } from "@/lib/admin/rbac";
import type { AdminListQuery, AdminRecord } from "@/lib/admin/types";

interface DatabaseFilters {
  org_id: string;
  project_id: string;
  kind: string;
  state: string;
  sort_order: string;
}

const emptyFilters: DatabaseFilters = {
  org_id: "",
  project_id: "",
  kind: "",
  state: "",
  sort_order: "desc",
};

export function DatabaseListPage() {
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "databases.read");
  const [filters, setFilters] = useState(emptyFilters);
  const [draft, setDraft] = useState(emptyFilters);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const query = useAdminQuery(
    ["databases", filters, cursor],
    (api) => api.databases.list({ ...filters, cursor, limit: 25 } as AdminListQuery),
    { enabled: canRead },
  );
  const rows = query.data?.data.databases ?? [];
  const nextCursor = query.data?.data.next_cursor ?? null;
  const columns = useMemo<TableColumn<AdminRecord>[]>(
    () => [
      {
        key: "database",
        label: "Database",
        render: (row) => (
          <Link
            href={`/databases/${encodeURIComponent(String(row.id ?? ""))}`}
            className="primary-cell"
          >
            <span className="row-avatar">DB</span>
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
        key: "size",
        label: "Observed size",
        align: "right",
        render: (row) =>
          typeof row.size_bytes === "string" || typeof row.size_bytes === "number"
            ? formatBytes(Number(row.size_bytes))
            : "Not reported",
      },
      {
        key: "updated",
        label: "Updated",
        render: (row) => formatDate(row.updated_at ?? row.created_at),
      },
    ],
    [],
  );

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Data products" title="Project databases" />
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
        title="Project databases"
        description="Safe project-scoped database projections. Credentials and connection endpoints are never shown."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["databases"] })}
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
              onChange={(event) =>
                setDraft((current) => ({ ...current, org_id: event.target.value }))
              }
              placeholder="Optional org_…"
            />
          </Field>
          <Field label="Project ID">
            <TextInput
              value={draft.project_id}
              onChange={(event) =>
                setDraft((current) => ({ ...current, project_id: event.target.value }))
              }
              placeholder="Optional prj_…"
            />
          </Field>
          <Field label="Engine">
            <SelectInput
              value={draft.kind}
              onChange={(event) =>
                setDraft((current) => ({ ...current, kind: event.target.value }))
              }
            >
              <option value="">All engines</option>
              <option value="sql">HavenSQL</option>
              <option value="mongo">HavenMongo</option>
              <option value="cache">HavenCache</option>
            </SelectInput>
          </Field>
          <Field label="State">
            <TextInput
              value={draft.state}
              onChange={(event) =>
                setDraft((current) => ({ ...current, state: event.target.value }))
              }
              placeholder="Optional state"
            />
          </Field>
          <div className="filter-actions">
            <Button type="submit" variant="primary">
              Apply
            </Button>
            <Button
              type="button"
              variant="quiet"
              onClick={() => {
                setDraft(emptyFilters);
                setFilters(emptyFilters);
                setCursorStack([undefined]);
              }}
            >
              Clear
            </Button>
          </div>
        </form>
        {query.isLoading ? (
          <QueryLoading label="Loading project databases…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length ? (
          <>
            <DataTable
              caption="Project databases"
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
                label="project databases"
              />
            </div>
          </>
        ) : (
          <QueryEmpty
            title="No project databases"
            description="No records matched these filters. This is a successful empty result."
          />
        )}
      </Card>
    </>
  );
}

export function DatabaseDetailPage({ id }: { id: string }) {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "databases.read");
  const canWrite = hasPermission(admin?.permissions ?? [], "databases.write");
  const query = useAdminQuery(["database", id], (api) => api.databases.detail(id), {
    enabled: canRead,
  });
  const [pendingAction, setPendingAction] = useState<"suspend" | "resume" | null>(null);
  const record = query.data?.data.database as AdminRecord | undefined;
  const state = String(record?.state ?? "");
  const version =
    typeof record?.version === "number" && record.version > 0 ? record.version : undefined;

  const submit = async (input: { reason?: string; expected_version?: number }) => {
    if (!pendingAction || input.expected_version === undefined) return;
    await runMutation({
      path: `/databases/${encodeURIComponent(id)}:${pendingAction}`,
      body: { expected_version: input.expected_version, reason: input.reason ?? "" },
      step_up_action: `admin:database_${pendingAction}`,
    });
    setPendingAction(null);
    await queryClient.invalidateQueries({ queryKey: ["database", id] });
    await queryClient.invalidateQueries({ queryKey: ["databases"] });
  };

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Data products" title="Project database" />
        <QueryEmpty
          title="Permission required"
          description="Your admin role does not include databases.read."
        />
      </>
    );
  if (query.isLoading)
    return (
      <>
        <PageHeader eyebrow="Data products" title="Project database" />
        <QueryLoading label="Loading database projection…" />
      </>
    );
  if (query.error)
    return (
      <>
        <PageHeader eyebrow="Data products" title="Project database" />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  if (!record)
    return (
      <>
        <PageHeader eyebrow="Data products" title="Project database" />
        <QueryEmpty
          title="Database unavailable"
          description="No database projection was returned."
        />
      </>
    );

  return (
    <>
      <PageHeader
        eyebrow="Data products / Project databases"
        title={String(record.name ?? id)}
        description="The projection contains safe connection metadata only."
        actions={
          <>
            {canWrite && state !== "SUSPENDED" && ["ACTIVE", "READ_ONLY"].includes(state) ? (
              <Button variant="danger-quiet" onClick={() => setPendingAction("suspend")}>
                Suspend project databases
              </Button>
            ) : null}
            {canWrite && state === "SUSPENDED" && record.state_reason === "admin_suspension" ? (
              <Button variant="primary" onClick={() => setPendingAction("resume")}>
                Resume project databases
              </Button>
            ) : null}
          </>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Database record</h2>
            <p>Versioned local state and measured usage.</p>
          </div>
          <StatusBadge value={record.state ?? "UNKNOWN"} />
        </div>
        {typeof record.state_reason === "string" ? (
          <p className="security-note">State reason: {humanize(record.state_reason)}</p>
        ) : null}
        <SafeRecordSummary record={record} />
        <AuditRef requestId={query.data?.request_id} auditId={record.audit_id} />
      </Card>
      {pendingAction ? (
        <ConfirmActionModal
          title={`${pendingAction === "suspend" ? "Suspend" : "Resume"} project database access`}
          target={`${String(record.project_id ?? "project")} · ${id}`}
          description="This action is audited and version guarded. Access changes apply to every supported database in the project."
          actionLabel={pendingAction}
          expectedVersion={version}
          reasonRequired
          dangerous={pendingAction === "suspend"}
          onConfirm={submit}
          onClose={() => setPendingAction(null)}
        />
      ) : null}
    </>
  );
}

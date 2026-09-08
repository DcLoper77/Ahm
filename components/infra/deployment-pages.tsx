"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate, humanize } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { useAdminSession } from "@/components/auth/session-context";
import { ConfirmActionModal } from "@/components/confirm-action";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import { AuditRef, RecordFacts, SafeRecordSummary } from "@/components/record-view";
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
import type { AdminRecord } from "@/lib/admin/types";

export function DeploymentsPage() {
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.roles ?? [], "hosting.read");
  const [draft, setDraft] = useState({ org_id: "", service_id: "", state: "", failure_stage: "" });
  const [filters, setFilters] = useState(draft);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const query = useAdminQuery(
    ["deployments", filters, cursor],
    (api) => api.hosting.deployments({ ...filters, cursor, limit: 25 }),
    { enabled: canRead },
  );
  const rows = query.data?.data.deployments ?? [];
  const nextCursor = query.data?.data.next_cursor ?? null;
  const columns = useMemo<TableColumn<AdminRecord>[]>(
    () => [
      {
        key: "deployment",
        label: "Deployment",
        render: (row) => {
          const id = String(row.id ?? row.deployment_id ?? "Unknown");
          return (
            <Link href={`/deployments/${id}`} className="primary-cell">
              <span className="row-avatar">D</span>
              <span className="primary-cell-copy">
                <strong>{id}</strong>
                <small>
                  {typeof row.service_id === "string" ? row.service_id : "Service not reported"}
                </small>
              </span>
            </Link>
          );
        },
      },
      {
        key: "state",
        label: "State",
        render: (row) => <StatusBadge value={row.state ?? row.status ?? "UNKNOWN"} />,
      },
      {
        key: "failure",
        label: "Failure stage",
        render: (row) =>
          row.failure_stage ? (
            <Badge tone="danger">{humanize(row.failure_stage)}</Badge>
          ) : (
            <Badge tone="success">No failure reported</Badge>
          ),
      },
      {
        key: "org",
        label: "Organization",
        render: (row) =>
          typeof row.org_id === "string" ? <span className="mono">{row.org_id}</span> : "—",
      },
      { key: "created", label: "Created", render: (row) => formatDate(row.created_at) },
    ],
    [],
  );
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({ ...draft });
    setCursorStack([undefined]);
  };
  const clear = () => {
    const empty = { org_id: "", service_id: "", state: "", failure_stage: "" };
    setDraft(empty);
    setFilters(empty);
    setCursorStack([undefined]);
  };
  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Infrastructure"
          title="Deployments"
          description="Hosting read access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask for hosting.read to inspect deployment evidence."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Infrastructure / Hosting"
        title="Deployments"
        description="Build and release evidence with retained-release rollback when the projection supports it."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["deployments"] })}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Deployment directory</h2>
            <p>Failure stage and code are bounded projections. Rollback never rebuilds.</p>
          </div>
          <Badge tone="info" icon="activity">
            Async aware
          </Badge>
        </div>
        <form className="filter-bar" onSubmit={apply}>
          <Field label="Organization ID">
            <TextInput
              value={draft.org_id}
              onChange={(event) =>
                setDraft((current) => ({ ...current, org_id: event.target.value }))
              }
              placeholder="Optional org_…"
            />
          </Field>
          <Field label="Service ID">
            <TextInput
              value={draft.service_id}
              onChange={(event) =>
                setDraft((current) => ({ ...current, service_id: event.target.value }))
              }
              placeholder="Optional svc_…"
            />
          </Field>
          <Field label="State">
            <SelectInput
              value={draft.state}
              onChange={(event) =>
                setDraft((current) => ({ ...current, state: event.target.value }))
              }
            >
              <option value="">All states</option>
              <option value="PENDING">Pending</option>
              <option value="RUNNING">Running</option>
              <option value="SUCCEEDED">Succeeded</option>
              <option value="FAILED">Failed</option>
            </SelectInput>
          </Field>
          <Field label="Failure stage">
            <TextInput
              value={draft.failure_stage}
              onChange={(event) =>
                setDraft((current) => ({ ...current, failure_stage: event.target.value }))
              }
              placeholder="e.g. build"
            />
          </Field>
          <div className="filter-actions">
            <Button type="submit" variant="primary">
              Apply
            </Button>
            <Button type="button" variant="quiet" onClick={clear}>
              Clear
            </Button>
          </div>
        </form>
        {query.isLoading ? (
          <QueryLoading label="Loading deployments…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length ? (
          <>
            <DataTable
              caption="Hosting deployments"
              rows={rows}
              rowKey={(row, index) => String(row.id ?? row.deployment_id ?? index)}
              columns={columns}
            />
            <div className="table-footer">
              <CursorPagination
                hasNext={Boolean(nextCursor)}
                canBack={cursorStack.length > 1}
                onNext={() => {
                  if (nextCursor) setCursorStack((stack) => [...stack, nextCursor]);
                }}
                onBack={() => {
                  if (cursorStack.length > 1) setCursorStack((stack) => stack.slice(0, -1));
                }}
                label="deployments"
              />
            </div>
          </>
        ) : (
          <QueryEmpty
            title="No deployments reported"
            description="The admin API returned no deployments for this filter set."
          />
        )}
      </Card>
    </>
  );
}

export function DeploymentDetailPage({ id }: { id: string }) {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.roles ?? [], "hosting.read");
  const canWrite = hasPermission(admin?.roles ?? [], "hosting.write");
  const query = useAdminQuery(["deployment", id], (api) => api.hosting.deployment(id), {
    enabled: canRead,
  });
  const [pending, setPending] = useState<"rollback" | "reconcile" | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const record = query.data?.data;
  const submit = async (input: { reason?: string }) => {
    if (!pending) return;
    const response = await runMutation<AdminRecord>({
      path:
        pending === "rollback"
          ? `/hosting/deployments/${encodeURIComponent(id)}:rollback`
          : `/hosting/deployments/${encodeURIComponent(id)}:reconcile`,
      body: input.reason ? { reason: input.reason } : {},
      step_up_action: `admin:deployment_${pending}`,
    });
    setRequestId(response.request_id);
    setPending(null);
    await queryClient.invalidateQueries({ queryKey: ["deployment", id] });
    await queryClient.invalidateQueries({ queryKey: ["deployments"] });
  };
  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Infrastructure" title="Deployment" />
        <QueryEmpty
          title="Permission required"
          description="Ask for hosting.read to inspect this deployment."
        />
      </>
    );
  if (query.isLoading)
    return (
      <>
        <PageHeader eyebrow="Infrastructure" title="Deployment" />
        <QueryLoading label="Loading deployment evidence…" />
      </>
    );
  if (query.error)
    return (
      <>
        <PageHeader eyebrow="Infrastructure" title="Deployment" />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  if (!record)
    return (
      <>
        <PageHeader eyebrow="Infrastructure" title="Deployment" />
        <QueryEmpty
          title="Deployment unavailable"
          description="The deployment is absent or outside your current role scope."
        />
      </>
    );
  const state = record.state ?? record.status ?? "UNKNOWN";
  const retained =
    record.retained_release_id ?? record.retained_release_ref ?? record.remote_release_ref;
  return (
    <>
      <PageHeader
        eyebrow="Infrastructure / Deployments"
        title={id}
        description="Safe release evidence with durable rollback and reconciliation actions."
        actions={
          <Link href="/deployments" className="button button-quiet">
            Back to deployments
          </Link>
        }
      />
      {requestId ? (
        <Card className="result-card">
          <div className="card-heading">
            <div>
              <h2>Deployment action accepted</h2>
              <p>
                Follow the new deployment/operation projection; the original evidence remains
                attached.
              </p>
            </div>
            <AuditRef requestId={requestId} />
          </div>
        </Card>
      ) : null}
      <div className="detail-grid">
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Release state</h2>
                <p>Failure evidence and observed state are safe admin projections.</p>
              </div>
              <StatusBadge value={state} />
            </div>
            <div className="detail-section">
              <RecordFacts
                record={record}
                fields={[
                  { key: "id", label: "Deployment ID", kind: "id" },
                  { key: "service_id", label: "Service", kind: "id" },
                  { key: "org_id", label: "Organization", kind: "id" },
                  { key: "state", label: "State", kind: "status" },
                  { key: "failure_stage", label: "Failure stage" },
                  { key: "failure_code", label: "Failure code" },
                  { key: "created_at", label: "Created", kind: "date" },
                  { key: "updated_at", label: "Updated", kind: "date" },
                ]}
              />
            </div>
          </Card>
          <SafeRecordSummary
            record={record}
            exclude={["id", "service_id", "org_id", "state", "status"]}
          />
        </div>
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Release actions</h2>
                <p>Rollback activates a retained release and never rebuilds.</p>
              </div>
              <Badge tone={retained ? "success" : "neutral"}>
                {retained ? "Retained release available" : "No retained release reported"}
              </Badge>
            </div>
            <div className="detail-section">
              <div className="action-row">
                {canWrite && retained ? (
                  <Button variant="danger" icon="rotate" onClick={() => setPending("rollback")}>
                    Rollback retained release
                  </Button>
                ) : null}
                {canWrite ? (
                  <Button
                    variant="secondary"
                    icon="refresh"
                    onClick={() => setPending("reconcile")}
                  >
                    Reconcile hosting
                  </Button>
                ) : (
                  <Badge tone="neutral">Read only</Badge>
                )}
              </div>
              <p className="security-note" style={{ marginTop: 14 }}>
                Hosting control is called asynchronously by the backend worker. The browser never
                calls a provider or worker URL.
              </p>
            </div>
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <h2>Audit trail</h2>
                <p>Review the request and target history for this deployment.</p>
              </div>
            </div>
            <div className="detail-section">
              <Link
                href={`/audit?target_id=${encodeURIComponent(id)}`}
                className="button button-quiet"
              >
                Open audit history <span>→</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
      {pending ? (
        <ConfirmActionModal
          title={pending === "rollback" ? "Rollback retained release" : "Reconcile deployment"}
          target={id}
          description={
            pending === "rollback"
              ? "This queues a new rollback deployment against the retained release."
              : "This queues the hosting reconciler to re-read the durable projection."
          }
          actionLabel={pending === "rollback" ? "Rollback release" : "Reconcile"}
          reasonRequired={pending === "rollback"}
          dangerous={pending === "rollback"}
          onConfirm={submit}
          onClose={() => setPending(null)}
        />
      ) : null}
    </>
  );
}

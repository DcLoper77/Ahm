"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate, humanize, isSensitiveKey, safeScalar } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { useAdminSession } from "@/components/auth/session-context";
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
  InlineAlert,
  PageHeader,
  SelectInput,
  StatusBadge,
  TableColumn,
  TextInput,
} from "@/components/ui";
import type { AdminRecord } from "@/lib/admin/types";

export function AuditPage() {
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "audit.read");
  const [draft, setDraft] = useState({
    actor_id: "",
    action: "",
    target_id: "",
    target_type: "",
    outcome: "",
    from: "",
    to: "",
  });
  const [filters, setFilters] = useState(draft);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const query = useAdminQuery(
    ["audit", filters, cursor],
    (api) => api.audit.list({ ...filters, cursor, limit: 25, sort_by: "seq", sort_order: "desc" }),
    { enabled: canRead },
  );
  const rows = query.data?.data.audit ?? [];
  const nextCursor = query.data?.data.next_cursor ?? null;
  const columns = useMemo<TableColumn<AdminRecord>[]>(
    () => [
      {
        key: "action",
        label: "Action",
        render: (row) => (
          <span className="primary-cell">
            <span className="row-avatar">A</span>
            <span className="primary-cell-copy">
              <strong>{humanize(row.action ?? "Administrative event")}</strong>
              <small>
                {typeof row.target_type === "string"
                  ? humanize(row.target_type)
                  : "Target not reported"}
              </small>
            </span>
          </span>
        ),
      },
      {
        key: "actor",
        label: "Actor",
        render: (row) =>
          typeof row.actor_id === "string" ? <span className="mono">{row.actor_id}</span> : "—",
      },
      {
        key: "target",
        label: "Target",
        render: (row) =>
          typeof row.target_id === "string" ? <span className="mono">{row.target_id}</span> : "—",
      },
      {
        key: "outcome",
        label: "Outcome",
        render: (row) => <StatusBadge value={row.outcome ?? "UNKNOWN"} />,
      },
      {
        key: "request",
        label: "Request",
        render: (row) => <AuditRef requestId={row.request_id} />,
      },
      {
        key: "time",
        label: "Recorded",
        render: (row) => formatDate(row.created_at ?? row.occurred_at),
      },
    ],
    [],
  );
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({ ...draft });
    setCursorStack([undefined]);
  };
  const clear = () => {
    const empty = {
      actor_id: "",
      action: "",
      target_id: "",
      target_type: "",
      outcome: "",
      from: "",
      to: "",
    };
    setDraft(empty);
    setFilters(empty);
    setCursorStack([undefined]);
  };
  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Control"
          title="Audit log"
          description="Audit access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask for audit.read to inspect redacted administrative evidence."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Control"
        title="Audit log"
        description="Redacted hash-chain evidence with actor, target, request, outcome, and before/after metadata where the projection permits."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["audit"] })}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Administrative evidence</h2>
            <p>Audit records use signed cursors and are never cached indefinitely.</p>
          </div>
          <Badge tone="info" icon="shield">
            Hash-chain aware
          </Badge>
        </div>
        <form className="filter-bar" onSubmit={apply}>
          <Field label="Actor ID">
            <TextInput
              value={draft.actor_id}
              onChange={(event) =>
                setDraft((current) => ({ ...current, actor_id: event.target.value }))
              }
              placeholder="adm_…"
            />
          </Field>
          <Field label="Action">
            <TextInput
              value={draft.action}
              onChange={(event) =>
                setDraft((current) => ({ ...current, action: event.target.value }))
              }
              placeholder="Action name"
            />
          </Field>
          <Field label="Target ID">
            <TextInput
              value={draft.target_id}
              onChange={(event) =>
                setDraft((current) => ({ ...current, target_id: event.target.value }))
              }
              placeholder="Resource ID"
            />
          </Field>
          <Field label="Outcome">
            <SelectInput
              value={draft.outcome}
              onChange={(event) =>
                setDraft((current) => ({ ...current, outcome: event.target.value }))
              }
            >
              <option value="">All outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="DENIED">Denied</option>
              <option value="FAILED">Failed</option>
            </SelectInput>
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
          <QueryLoading label="Loading audit evidence…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length ? (
          <>
            <DataTable
              caption="Administrative audit log"
              rows={rows}
              rowKey={(row, index) => String(row.id ?? row.seq ?? index)}
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
                label="audit events"
              />
            </div>
          </>
        ) : (
          <QueryEmpty
            title="No audit events match"
            description="Try a different actor, action, target, or outcome filter."
          />
        )}
      </Card>
    </>
  );
}

type OperationsTab = "health" | "jobs" | "outbox" | "quarantine";
const reconcilerSystems = ["databases", "quick_databases", "billing"] as const;

function recordsFor(data: AdminRecord | undefined, keys: string[]): AdminRecord[] {
  if (!data) return [];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value))
      return value.filter((item): item is AdminRecord => Boolean(item && typeof item === "object"));
  }
  return [];
}

export function SystemPage() {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "system.read");
  const canWrite = hasPermission(admin?.permissions ?? [], "system.write");
  const [tab, setTab] = useState<OperationsTab>("health");
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const [pending, setPending] = useState<{
    action: "requeue-job" | "requeue-outbox" | "reconciler" | "approve" | "reject" | "execute";
    id: string;
    record?: AdminRecord;
  } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const health = useAdminQuery(["system", "health"], (api) => api.system.health(), {
    enabled: canRead && tab === "health",
  });
  const jobs = useAdminQuery(
    ["system", "jobs", cursor],
    (api) => api.system.jobs({ limit: 25, cursor }),
    {
      enabled: canRead && tab === "jobs",
    },
  );
  const outbox = useAdminQuery(
    ["system", "outbox", cursor],
    (api) => api.system.outbox({ limit: 25, cursor }),
    {
      enabled: canRead && tab === "outbox",
    },
  );
  const quarantine = useAdminQuery(
    ["system", "quarantine", cursor],
    (api) => api.system.quarantine({ limit: 25, cursor }),
    { enabled: canRead && tab === "quarantine" },
  );
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["system", tab] });
  const submit = async (input: { reason?: string }) => {
    if (!pending) return;
    let response;
    if (pending.action === "requeue-job")
      response = await runMutation<AdminRecord>({
        path: `/system/jobs/${encodeURIComponent(pending.id)}:requeue`,
        body: {},
        step_up_action: "admin:job_requeue",
      });
    else if (pending.action === "requeue-outbox")
      response = await runMutation<AdminRecord>({
        path: `/system/outbox/${encodeURIComponent(pending.id)}:requeue`,
        body: {},
        step_up_action: "admin:outbox_requeue",
      });
    else if (pending.action === "reconciler")
      response = await runMutation<AdminRecord>({
        path: `/system/reconcilers/${encodeURIComponent(pending.id)}:run`,
        body: {},
        step_up_action: "admin:reconciler_run",
      });
    else
      response = await runMutation<AdminRecord>({
        path: `/system/quarantine/${encodeURIComponent(pending.id)}:${pending.action}`,
        body: pending.action === "reject" ? { note: input.reason ?? "" } : {},
        step_up_action: `admin:quarantine_${pending.action}`,
      });
    setRequestId(response.request_id);
    setPending(null);
    refresh();
  };
  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Control"
          title="Operations"
          description="System operation access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask for system.read to inspect health, jobs, outbox, and quarantine."
        />
      </>
    );
  const busy = health.isLoading || jobs.isLoading || outbox.isLoading || quarantine.isLoading;
  const activeQuery =
    tab === "health" ? health : tab === "jobs" ? jobs : tab === "outbox" ? outbox : quarantine;
  const data = activeQuery.data?.data as AdminRecord | undefined;
  const rows = recordsFor(
    data,
    tab === "jobs"
      ? ["jobs", "items"]
      : tab === "outbox"
        ? ["outbox", "items"]
        : ["quarantine", "items"],
  );
  return (
    <>
      <PageHeader
        eyebrow="Control"
        title="Operations"
        description="Health, durable jobs, outbox retry evidence, and two-person quarantine controls."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={refresh}
            loading={activeQuery.isFetching}
          >
            Refresh
          </Button>
        }
      />
      {requestId ? (
        <InlineAlert tone="success" title="Durable action accepted">
          Request {requestId} was recorded. The original evidence remains visible while the
          projection changes.
        </InlineAlert>
      ) : null}
      <div className="tabs">
        {(["health", "jobs", "outbox", "quarantine"] as OperationsTab[]).map((item) => (
          <button
            key={item}
            className={`tab ${tab === item ? "is-active" : ""}`}
            onClick={() => {
              setTab(item);
              setCursorStack([undefined]);
            }}
          >
            {humanize(item)}
          </button>
        ))}
      </div>
      {canWrite ? (
        <Card className="operation-control-card">
          <div className="card-heading">
            <div>
              <h2>Queue a reconciler</h2>
              <p>
                Reconciliation creates a durable admin intent. The browser only queues the
                operation; it does not perform the reconciliation itself.
              </p>
            </div>
            <Badge tone="warning" icon="refresh">
              Durable queue
            </Badge>
          </div>
          <div className="action-row">
            {reconcilerSystems.map((system) => (
              <Button
                key={system}
                variant="secondary"
                onClick={() => setPending({ action: "reconciler", id: system })}
              >
                {humanize(system)}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}
      <Card>
        {busy && activeQuery.isLoading ? (
          <QueryLoading label={`Loading ${tab}…`} />
        ) : activeQuery.error ? (
          <QueryError error={activeQuery.error} onRetry={() => void activeQuery.refetch()} />
        ) : tab === "health" ? (
          <HealthProjection data={data} />
        ) : (
          <>
            <OperationsTable
              tab={tab}
              rows={rows}
              canWrite={canWrite}
              onAction={(action, id, record) => setPending({ action, id, record })}
            />
            <div className="table-footer">
              <CursorPagination
                hasNext={typeof data?.next_cursor === "string"}
                canBack={cursorStack.length > 1}
                onNext={() => {
                  if (typeof data?.next_cursor === "string")
                    setCursorStack((stack) => [...stack, data.next_cursor as string]);
                }}
                onBack={() =>
                  setCursorStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack))
                }
                label={tab}
              />
            </div>
          </>
        )}
      </Card>
      {pending ? (
        <ConfirmActionModal
          title={pending.action.replaceAll("-", " ").replace(/\b\w/g, (char) => char.toUpperCase())}
          target={pending.id}
          description={
            pending.action.startsWith("requeue")
              ? "This clones the terminal record into a fresh durable identity and retains the original evidence."
              : pending.action === "execute"
                ? "This may perform guarded remediation after two-person approval and a fresh MFA proof."
                : "The admin operation will be queued and remain auditable."
          }
          actionLabel={
            pending.action === "reject"
              ? "Reject"
              : pending.action === "execute"
                ? "Execute"
                : pending.action === "approve"
                  ? "Approve"
                  : "Continue"
          }
          reasonRequired={pending.action === "reject"}
          dangerous={pending.action === "execute" || pending.action === "reject"}
          onConfirm={submit}
          onClose={() => setPending(null)}
        />
      ) : null}
    </>
  );
}

function HealthProjection({ data }: { data: AdminRecord | undefined }) {
  const rows = data
    ? Object.entries(data)
        .filter(([key, value]) => !isSensitiveKey(key) && safeScalar(value) !== null)
        .slice(0, 20)
    : [];
  return rows.length ? (
    <div className="projection-grid">
      {rows.map(([key, value]) => (
        <div className="projection-tile" key={key}>
          <span>{humanize(key)}</span>
          <strong>{String(value)}</strong>
        </div>
      ))}
    </div>
  ) : (
    <QueryEmpty
      title="No health signals reported"
      description="The system health projection returned no safe scalar values for this role."
    />
  );
}
function OperationsTable({
  tab,
  rows,
  canWrite,
  onAction,
}: {
  tab: OperationsTab;
  rows: AdminRecord[];
  canWrite: boolean;
  onAction: (
    action: "requeue-job" | "requeue-outbox" | "reconciler" | "approve" | "reject" | "execute",
    id: string,
    record?: AdminRecord,
  ) => void;
}) {
  if (!rows.length)
    return (
      <QueryEmpty
        title={`No ${tab} records`}
        description="The admin API returned an empty projection for this operation family."
      />
    );
  const columns: TableColumn<AdminRecord>[] = [
    {
      key: "record",
      label: "Record",
      render: (row) => (
        <span className="primary-cell">
          <span className="row-avatar">
            {tab === "quarantine" ? "Q" : tab === "jobs" ? "J" : "O"}
          </span>
          <span className="primary-cell-copy">
            <strong>
              {typeof row.type === "string"
                ? humanize(row.type)
                : typeof row.intent === "string"
                  ? humanize(row.intent)
                  : String(row.id ?? "Record")}
            </strong>
            <small>{String(row.id ?? row.job_id ?? row.outbox_id ?? "")}</small>
          </span>
        </span>
      ),
    },
    {
      key: "state",
      label: "State",
      render: (row) => <StatusBadge value={row.state ?? row.status ?? "UNKNOWN"} />,
    },
    {
      key: "evidence",
      label: "Evidence",
      render: (row) =>
        tab === "quarantine" ? (
          <QuarantineGuardrails record={row} />
        ) : (
          <SafeRecordSummary record={row} exclude={["id", "state", "status"]} />
        ),
    },
    {
      key: "time",
      label: "Updated",
      render: (row) => formatDate(row.updated_at ?? row.created_at ?? row.observed_at),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => {
        const id = String(row.id ?? row.job_id ?? row.outbox_id ?? "");
        if (!canWrite || !id) return <Badge tone="neutral">Read only</Badge>;
        if (tab === "jobs" && String(row.state) === "DEAD")
          return (
            <Button variant="secondary" onClick={() => onAction("requeue-job", id, row)}>
              Requeue
            </Button>
          );
        if (tab === "outbox" && String(row.state) === "FAILED")
          return (
            <Button variant="secondary" onClick={() => onAction("requeue-outbox", id, row)}>
              Requeue
            </Button>
          );
        if (tab === "quarantine") {
          const state = String(row.state);
          if (state === "OPEN")
            return (
              <Button variant="secondary" onClick={() => onAction("approve", id, row)}>
                Approve
              </Button>
            );
          if (state === "APPROVED")
            return (
              <div className="action-row">
                <Button variant="danger-quiet" onClick={() => onAction("execute", id, row)}>
                  Execute
                </Button>
                <Button variant="quiet" onClick={() => onAction("reject", id, row)}>
                  Reject
                </Button>
              </div>
            );
        }
        return null;
      },
    },
  ];
  return (
    <DataTable
      caption={`${tab} operations`}
      rows={rows}
      rowKey={(row, index) => String(row.id ?? index)}
      columns={columns}
    />
  );
}

function QuarantineGuardrails({ record }: { record: AdminRecord }) {
  const approvalCount = Array.isArray(record.approvals)
    ? record.approvals.length
    : safeScalar(record.approval_count ?? record.approvals_count);
  const requiredApprovals = safeScalar(record.required_approvals);
  const executorEligible = safeScalar(record.executor_eligible);
  const escalation = safeScalar(record.escalation_state ?? record.escalation);
  const clock = record.expires_at ?? record.approval_expires_at ?? record.clock;
  return (
    <div className="quarantine-evidence">
      <span>
        Approvals <strong>{approvalCount === null ? "Not reported" : String(approvalCount)}</strong>
        {requiredApprovals !== null ? ` / ${String(requiredApprovals)}` : ""}
      </span>
      <span>
        Executor{" "}
        <strong>{executorEligible === null ? "Not reported" : String(executorEligible)}</strong>
      </span>
      <span>
        Clock <strong>{typeof clock === "string" ? formatDate(clock) : "Not reported"}</strong>
      </span>
      <span>
        Escalation <strong>{escalation === null ? "Not reported" : String(escalation)}</strong>
      </span>
      <small>Two-person approval remains server-enforced.</small>
    </div>
  );
}

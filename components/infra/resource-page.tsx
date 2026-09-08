"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate, humanize } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import type { ApiResult } from "@/lib/admin/client";
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

export type InfraKind = "hosting" | "domains" | "databases" | "vps";

const configs: Record<
  InfraKind,
  {
    title: string;
    eyebrow: string;
    description: string;
    icon: "server" | "globe" | "database" | "cpu";
    read: "hosting.read" | "domains.read" | "databases.read" | "vps.read";
    write: "hosting.write" | "domains.write" | "databases.write" | "vps.write";
    dataKey: string;
    href: string;
  }
> = {
  hosting: {
    title: "Hosting",
    eyebrow: "Infrastructure",
    description: "Desired, observed, route, sync, deployment, and failure state.",
    icon: "server",
    read: "hosting.read",
    write: "hosting.write",
    dataKey: "hosting_projects",
    href: "/hosting",
  },
  domains: {
    title: "Domains",
    eyebrow: "Infrastructure",
    description: "Ownership, routing, certificate, renewal, and failure state.",
    icon: "globe",
    read: "domains.read",
    write: "domains.write",
    dataKey: "domains",
    href: "/domains",
  },
  databases: {
    title: "Databases",
    eyebrow: "Infrastructure",
    description: "Safe connection metadata, project scope, usage, and failure evidence.",
    icon: "database",
    read: "databases.read",
    write: "databases.write",
    dataKey: "databases",
    href: "/databases",
  },
  vps: {
    title: "HavenVPS",
    eyebrow: "Infrastructure",
    description: "Instance state, AIC observations, plan/spec, and Founder bundle evidence.",
    icon: "cpu",
    read: "vps.read",
    write: "vps.write",
    dataKey: "vps",
    href: "/vps",
  },
};

async function listFor(
  api: ReturnType<typeof useAdminSession>["api"],
  kind: InfraKind,
  query: AdminRecord,
): Promise<ApiResult<AdminRecord>> {
  const result =
    kind === "hosting"
      ? await api.hosting.projects(query)
      : kind === "domains"
        ? await api.domains.list(query)
        : kind === "databases"
          ? await api.databases.list(query)
          : await api.vps.list(query);
  return { data: result.data as AdminRecord, request_id: result.request_id };
}

function detailFor(api: ReturnType<typeof useAdminSession>["api"], kind: InfraKind, id: string) {
  if (kind === "hosting") return api.hosting.project(id);
  if (kind === "domains") return api.domains.detail(id);
  if (kind === "databases") return api.databases.detail(id);
  return api.vps.detail(id);
}

function rowsFrom(kind: InfraKind, data: AdminRecord | undefined): AdminRecord[] {
  if (!data) return [];
  const key = configs[kind].dataKey;
  const rows = data[key];
  return Array.isArray(rows)
    ? rows.filter((row): row is AdminRecord => Boolean(row && typeof row === "object"))
    : [];
}

export function InfraListPage({ kind }: { kind: InfraKind }) {
  const config = configs[kind];
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.roles ?? [], config.read);
  const [filters, setFilters] = useState({
    org_id: "",
    state: "",
    sort_by: "created_at",
    sort_order: "desc",
  });
  const [draft, setDraft] = useState(filters);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const query = useAdminQuery(
    [kind, filters, cursor],
    (api) => listFor(api, kind, { ...filters, cursor, limit: 25 }),
    { enabled: canRead },
  );
  const rows = rowsFrom(kind, query.data?.data as AdminRecord | undefined);
  const nextCursor =
    typeof (query.data?.data as AdminRecord | undefined)?.next_cursor === "string"
      ? String((query.data?.data as AdminRecord).next_cursor)
      : null;
  const columns = useMemo<TableColumn<AdminRecord>[]>(
    () => [
      {
        key: "primary",
        label:
          kind === "hosting"
            ? "Project"
            : kind === "domains"
              ? "Domain"
              : kind === "databases"
                ? "Database"
                : "Instance",
        render: (row) => {
          const id = typeof row.id === "string" ? row.id : "Unknown ID";
          const primary =
            typeof row.name === "string"
              ? row.name
              : typeof row.fqdn === "string"
                ? row.fqdn
                : typeof row.hostname === "string"
                  ? row.hostname
                  : id;
          return (
            <Link href={`${config.href}/${id}`} className="primary-cell">
              <span className="row-avatar">
                {kind === "domains"
                  ? "D"
                  : kind === "databases"
                    ? "DB"
                    : kind === "vps"
                      ? "V"
                      : "H"}
              </span>
              <span className="primary-cell-copy">
                <strong>{primary}</strong>
                <small>{id}</small>
              </span>
            </Link>
          );
        },
      },
      {
        key: "state",
        label: "State",
        render: (row) => (
          <StatusBadge value={row.state ?? row.desired_state ?? row.status ?? "UNKNOWN"} />
        ),
      },
      {
        key: "owner",
        label: "Organization",
        render: (row) =>
          typeof row.org_id === "string" ? <span className="mono">{row.org_id}</span> : "—",
      },
      {
        key: "sync",
        label: kind === "hosting" ? "Sync" : "Version",
        render: (row) =>
          kind === "hosting" ? (
            <StatusBadge value={row.sync_state ?? "UNKNOWN"} />
          ) : (
            <span className="mono">
              {typeof row.version === "number" ? `v${row.version}` : "—"}
            </span>
          ),
      },
      {
        key: "updated",
        label: "Updated",
        render: (row) => formatDate(row.updated_at ?? row.created_at),
      },
    ],
    [config.href, kind],
  );

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({ ...draft });
    setCursorStack([undefined]);
  };
  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow={config.eyebrow}
          title={config.title}
          description={`This ${kind} read capability is not included in your current role.`}
        />
        <QueryEmpty
          title="Permission required"
          description={`Ask for ${config.read} to inspect this view.`}
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => void queryClient.invalidateQueries({ queryKey: [kind] })}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>{config.title} directory</h2>
            <p>
              Signed cursor pagination · safe admin projection · external provider state is shown
              only when observed
            </p>
          </div>
          <Badge tone="info" icon={config.icon}>
            Operational view
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
          <Field label="State">
            <SelectInput
              value={draft.state}
              onChange={(event) =>
                setDraft((current) => ({ ...current, state: event.target.value }))
              }
            >
              <option value="">All states</option>
              <option value="RUNNING">Running</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="STOPPED">Stopped</option>
            </SelectInput>
          </Field>
          <Field label="Sort">
            <SelectInput
              value={draft.sort_by}
              onChange={(event) =>
                setDraft((current) => ({ ...current, sort_by: event.target.value }))
              }
            >
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
              <option value="state">State</option>
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
                setDraft({ org_id: "", state: "", sort_by: "created_at", sort_order: "desc" });
                setFilters({ org_id: "", state: "", sort_by: "created_at", sort_order: "desc" });
              }}
            >
              Clear
            </Button>
          </div>
        </form>
        {query.isLoading ? (
          <QueryLoading label={`Loading ${kind}…`} />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length ? (
          <>
            <DataTable
              caption={config.title}
              rows={rows}
              rowKey={(row, index) => String(row.id ?? index)}
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
                label={kind}
              />
            </div>
          </>
        ) : (
          <QueryEmpty
            title={`No ${kind} reported`}
            description="The admin API returned an empty page for this filter set."
          />
        )}
      </Card>
    </>
  );
}

export function InfraDetailPage({ kind, id }: { kind: InfraKind; id: string }) {
  const config = configs[kind];
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.roles ?? [], config.read);
  const canWrite = hasPermission(admin?.roles ?? [], config.write);
  const query = useAdminQuery([kind, id], (api) => detailFor(api, kind, id), { enabled: canRead });
  const [pending, setPending] = useState<{ action: string; record: AdminRecord } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const record = query.data?.data;
  const state = record?.state ?? record?.desired_state ?? record?.status;

  const actionList =
    kind === "hosting"
      ? ["start", "stop", "restart", "suspend", "restore", "reconcile"]
      : kind === "domains"
        ? ["reverify", "suspend", "restore", "remove"]
        : kind === "databases"
          ? ["suspend", "resume", "reconcile"]
          : ["start", "stop", "restart", "suspend", "restore", "reconcile"];
  const actionBody = (action: string, input: { reason?: string; expected_version?: number }) => {
    const body: AdminRecord = {};
    if (input.reason) body.reason = input.reason;
    if (input.expected_version !== undefined) body.expected_version = input.expected_version;
    if (kind === "hosting" && action !== "reconcile")
      body.expected_desired_version =
        typeof record?.desired_version === "number" ? record.desired_version : 1;
    return body;
  };
  const submit = async (input: { reason?: string; expected_version?: number }) => {
    if (!pending) return;
    const action = pending.action;
    const body = actionBody(action, input);
    const path =
      kind === "hosting"
        ? `/hosting/projects/${encodeURIComponent(id)}:${action}`
        : kind === "domains"
          ? `/domains/${encodeURIComponent(id)}:${action}`
          : kind === "databases"
            ? `/databases/${encodeURIComponent(id)}:${action}`
            : `/infrastructure/vps/${encodeURIComponent(id)}:${action}`;
    const response = await runMutation<AdminRecord>({
      path,
      body,
      step_up_action: `admin:${kind}_${action}`,
    });
    setRequestId(response.request_id);
    setPending(null);
    await queryClient.invalidateQueries({ queryKey: [kind, id] });
    await queryClient.invalidateQueries({ queryKey: [kind] });
  };

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow={config.eyebrow} title={config.title} />
        <QueryEmpty
          title="Permission required"
          description={`Ask for ${config.read} to inspect this record.`}
        />
      </>
    );
  if (query.isLoading)
    return (
      <>
        <PageHeader eyebrow={config.eyebrow} title={config.title} />
        <QueryLoading label={`Loading ${kind} detail…`} />
      </>
    );
  if (query.error)
    return (
      <>
        <PageHeader eyebrow={config.eyebrow} title={config.title} />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  if (!record)
    return (
      <>
        <PageHeader eyebrow={config.eyebrow} title={config.title} />
        <QueryEmpty
          title="Record unavailable"
          description="The record is absent or outside your current role scope."
        />
      </>
    );
  const title =
    typeof record.name === "string"
      ? record.name
      : typeof record.fqdn === "string"
        ? record.fqdn
        : id;
  const expectedVersion = typeof record.version === "number" ? record.version : undefined;
  return (
    <>
      <PageHeader
        eyebrow={`${config.eyebrow} / ${config.title}`}
        title={title}
        description="The admin projection remains the source of truth for current state, failure evidence, and next valid actions."
        actions={
          <Link href={config.href} className="button button-quiet">
            <span>Back to {config.title.toLowerCase()}</span>
          </Link>
        }
      />
      <div className="action-strip">
        <div>
          <StatusBadge value={state ?? "UNKNOWN"} />
          <span className="action-strip-copy">
            {kind === "hosting"
              ? `Desired ${humanize(record.desired_state ?? "not reported")} · observed ${humanize(record.observed_state ?? "not reported")}`
              : kind === "domains"
                ? `Ownership ${humanize(record.ownership_state ?? "not reported")} · routing ${humanize(record.routing_state ?? "not reported")}`
                : kind === "databases"
                  ? `Project-scoped access state ${humanize(record.state ?? "not reported")}`
                  : `AIC observation ${humanize(record.aic_state ?? record.observed_state ?? "not reported")}`}
          </span>
        </div>
        <div className="action-row">
          {canWrite ? (
            actionList
              .filter(
                (action) =>
                  action !== "reconcile" || hasPermission(admin?.roles ?? [], "system.write"),
              )
              .map((action) => (
                <Button
                  key={action}
                  variant={
                    action === "remove" || action === "suspend" || action === "stop"
                      ? "danger-quiet"
                      : action === "reconcile" || action === "reverify"
                        ? "secondary"
                        : "primary"
                  }
                  icon={
                    action === "reconcile" || action === "reverify"
                      ? "refresh"
                      : action === "start" || action === "restore" || action === "resume"
                        ? "play"
                        : action === "remove"
                          ? "trash"
                          : "pause"
                  }
                  onClick={() => setPending({ action, record })}
                >
                  {humanize(action)}
                </Button>
              ))
          ) : (
            <Badge tone="neutral">Read only</Badge>
          )}
        </div>
      </div>
      {requestId ? (
        <Card className="result-card">
          <div className="card-heading">
            <div>
              <h2>Action accepted</h2>
              <p>The local intent was accepted. Follow the target projection as it converges.</p>
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
                <h2>Current projection</h2>
                <p>Safe fields from the documented admin DTO.</p>
              </div>
              <StatusBadge value={state ?? "UNKNOWN"} />
            </div>
            <div className="detail-section">
              <RecordFacts
                record={record}
                fields={[
                  { key: "id", label: "Resource ID", kind: "id" },
                  { key: "org_id", label: "Organization", kind: "id" },
                  { key: "project_id", label: "Project", kind: "id" },
                  { key: "desired_state", label: "Desired state", kind: "status" },
                  { key: "observed_state", label: "Observed state", kind: "status" },
                  { key: "sync_state", label: "Sync state", kind: "status" },
                  { key: "route_observed_state", label: "Route state", kind: "status" },
                  {
                    key: "certificate_observed_state",
                    label: "Certificate observation",
                    kind: "status",
                  },
                  { key: "version", label: "Version" },
                  { key: "updated_at", label: "Updated", kind: "date" },
                ]}
              />
            </div>
          </Card>
          <SafeRecordSummary
            record={record}
            exclude={[
              "id",
              "org_id",
              "project_id",
              "name",
              "fqdn",
              "desired_state",
              "observed_state",
              "sync_state",
              "version",
            ]}
          />
        </div>
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Failure & operation evidence</h2>
                <p>Bounded evidence remains visible while the projection is degraded or pending.</p>
              </div>
              <Badge tone="info" icon="activity">
                Observed
              </Badge>
            </div>
            <div className="detail-section">
              <RecordFacts
                record={record}
                fields={[
                  { key: "failure_stage", label: "Failure stage" },
                  { key: "failure_code", label: "Failure code" },
                  { key: "last_error", label: "Last error" },
                  { key: "operation_id", label: "Operation", kind: "id" },
                  { key: "job_id", label: "Job", kind: "id" },
                  { key: "outbox_id", label: "Outbox", kind: "id" },
                ]}
              />
            </div>
          </Card>
          {kind === "databases" ? (
            <Card>
              <div className="card-heading">
                <div>
                  <h2>Project-scoped suspension</h2>
                  <p>DunesBit access applies to every direct-wire database in the project.</p>
                </div>
                <Badge tone="warning">Scope warning</Badge>
              </div>
              <div className="detail-section">
                <p className="security-note">
                  Suspending this database may affect the other direct-wire databases returned in
                  affected_resource_ids. Review the durable response before treating the action as
                  complete.
                </p>
              </div>
            </Card>
          ) : null}
          {kind === "vps" ? (
            <Card>
              <div className="card-heading">
                <div>
                  <h2>Provisioning boundary</h2>
                  <p>AIC and Founder relationships are observations.</p>
                </div>
                <Badge tone="success" icon="lock">
                  Credentials hidden
                </Badge>
              </div>
              <div className="detail-section">
                <p className="security-note">
                  No root password or provider credential is exposed here. An ambiguous provisioning
                  state remains pending until the instance projection and AIC observation converge.
                </p>
              </div>
            </Card>
          ) : null}
          {kind === "hosting" ? (
            <Card>
              <div className="card-heading">
                <div>
                  <h2>Admin boundary</h2>
                  <p>Control panel operations are durable intent.</p>
                </div>
              </div>
              <div className="detail-section">
                <p className="security-note">
                  There is no generic host shell, raw Docker action, worker URL, or provider call in
                  this console. Use deployments and audit evidence to investigate failures.
                </p>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
      {pending ? (
        <ConfirmActionModal
          title={`${humanize(pending.action)} ${kind}`}
          target={title}
          description={
            pending.action === "reconcile" || pending.action === "reverify"
              ? "The admin service will queue a durable projection update."
              : "The backend checks current state, version, permission, and fresh MFA where required."
          }
          actionLabel={humanize(pending.action)}
          reasonRequired={
            pending.action !== "start" &&
            pending.action !== "restore" &&
            pending.action !== "resume"
          }
          dangerous={["stop", "suspend", "remove", "restart"].includes(pending.action)}
          expectedVersion={
            pending.action === "reconcile" || pending.action === "reverify"
              ? undefined
              : expectedVersion
          }
          onConfirm={submit}
          onClose={() => setPending(null)}
        />
      ) : null}
    </>
  );
}

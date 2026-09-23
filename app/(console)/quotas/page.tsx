"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { useAdminSession } from "@/components/auth/session-context";
import { ConfirmActionModal } from "@/components/confirm-action";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  PageHeader,
  SelectInput,
  TableColumn,
  TextArea,
  TextInput,
} from "@/components/ui";
import type { AdminRecord } from "@/lib/admin/types";

const quotaKeys = [
  "storage_bytes",
  "backup_manual_retained",
  "projects",
  "team_members",
  "store_per_project",
  "kv_per_project",
  "box_per_project",
  "sql_per_project",
  "mongo_per_project",
  "cache_per_project",
  "quick_databases_total",
  "quick_databases_redis",
  "api_requests_per_min",
] as const;

function overrideRows(data: AdminRecord | undefined): AdminRecord[] {
  if (!data) return [];
  const candidate = data.overrides ?? data.quotas ?? data.items;
  return Array.isArray(candidate)
    ? candidate.filter((item): item is AdminRecord => Boolean(item && typeof item === "object"))
    : [];
}

export default function QuotasPage() {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "quotas.read");
  const canWrite = hasPermission(admin?.permissions ?? [], "quotas.write");
  const [orgIdInput, setOrgIdInput] = useState("");
  const [orgId, setOrgId] = useState("");
  const [keyName, setKeyName] = useState<(typeof quotaKeys)[number]>("storage_bytes");
  const [value, setValue] = useState("0");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [expectedVersion, setExpectedVersion] = useState("0");
  const [clearKey, setClearKey] = useState<{ key: string; version: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const query = useAdminQuery(["quotas", orgId], (api) => api.quotas.get(orgId), {
    enabled: canRead && Boolean(orgId),
  });
  const rows = overrideRows(query.data?.data);
  const columns = useMemo<TableColumn<AdminRecord>[]>(
    () => [
      {
        key: "key",
        label: "Override",
        render: (row) => (
          <span className="primary-cell">
            <span className="row-avatar">
              <span>Q</span>
            </span>
            <span className="primary-cell-copy">
              <strong>{typeof row.key_name === "string" ? row.key_name : "Typed quota"}</strong>
              <small>{typeof row.reason === "string" ? row.reason : "Reason not reported"}</small>
            </span>
          </span>
        ),
      },
      {
        key: "value",
        label: "Value",
        render: (row) =>
          typeof row.value === "number" || typeof row.value === "string" ? String(row.value) : "—",
      },
      { key: "expires", label: "Expires", render: (row) => formatDate(row.expires_at) },
      {
        key: "version",
        label: "Version",
        render: (row) => (
          <span className="mono">v{typeof row.version === "number" ? row.version : "—"}</span>
        ),
      },
      {
        key: "action",
        label: "",
        align: "right",
        render: (row) => {
          const version = typeof row.version === "number" && row.version >= 1 ? row.version : null;
          return typeof row.key_name === "string" && version !== null ? (
            <Button
              variant="danger-quiet"
              icon="trash"
              onClick={() =>
                setClearKey({
                  key: row.key_name as string,
                  version,
                })
              }
            >
              Clear
            </Button>
          ) : typeof row.key_name === "string" ? (
            <Badge tone="warning">Waiting for version</Badge>
          ) : null;
        },
      },
    ],
    [],
  );

  const load = (event: React.FormEvent) => {
    event.preventDefault();
    setOrgId(orgIdInput.trim());
  };
  const setOverride = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId) return;
    setSaving(true);
    setMutationError(null);
    try {
      await runMutation({
        method: "PATCH",
        path: `/quotas/${encodeURIComponent(orgId)}`,
        body: {
          key_name: keyName,
          value: Number(value),
          expires_at: new Date(expiresAt).toISOString(),
          reason: reason.trim(),
          expected_version: Number(expectedVersion),
        },
        step_up_action: "admin:quota_override",
      });
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["quotas", orgId] });
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : "The quota override could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  const clear = async () => {
    if (!clearKey || !orgId) return;
    await runMutation({
      method: "DELETE",
      path: `/quotas/${encodeURIComponent(orgId)}/${encodeURIComponent(clearKey.key)}:clear`,
      body: { expected_version: clearKey.version },
      step_up_action: "admin:quota_clear",
    });
    setClearKey(null);
    await queryClient.invalidateQueries({ queryKey: ["quotas", orgId] });
  };

  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Catalogue / Quotas"
          title="Quota overrides"
          description="Quota access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask a platform administrator for quotas.read to inspect organization overrides."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Catalogue / Quotas"
        title="Quota overrides"
        description="Typed, expiring organization overrides with version guards, clamping feedback, and audit evidence."
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Choose an organization</h2>
            <p>
              The API scope is explicit. No organization data is loaded until an ID is provided.
            </p>
          </div>
          <Badge tone="info" icon="sliders">
            Typed values
          </Badge>
        </div>
        <form className="filter-bar" onSubmit={load}>
          <Field label="Organization ID">
            <TextInput
              value={orgIdInput}
              onChange={(event) => setOrgIdInput(event.target.value)}
              placeholder="org_…"
              required
            />
          </Field>
          <div className="filter-actions">
            <Button type="submit" variant="primary">
              Load overrides
            </Button>
            {orgId ? (
              <Button
                type="button"
                variant="quiet"
                icon="refresh"
                onClick={() => void query.refetch()}
                loading={query.isFetching}
              >
                Refresh
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
      {orgId ? (
        <div className="stack" style={{ marginTop: 18 }}>
          {mutationError ? (
            <p className="field-error" role="alert">
              {mutationError}
            </p>
          ) : null}
          <Card>
            <div className="card-heading">
              <div>
                <h2>Overrides for {orgId}</h2>
                <p>
                  Values can be clamped by platform ceilings; the durable response is the source of
                  truth.
                </p>
              </div>
            </div>
            {query.isLoading ? (
              <QueryLoading label="Loading quota overrides…" />
            ) : query.error ? (
              <QueryError error={query.error} onRetry={() => void query.refetch()} />
            ) : rows.length ? (
              <DataTable
                caption="Quota overrides"
                rows={rows}
                rowKey={(row, index) => String(row.key_name ?? index)}
                columns={columns}
              />
            ) : (
              <QueryEmpty
                title="No overrides reported"
                description="This organization has no typed quota overrides in the current projection."
              />
            )}
          </Card>
          {canWrite ? (
            <Card>
              <div className="card-heading">
                <div>
                  <h2>Set an override</h2>
                  <p>
                    Fresh MFA, reason, expiry, and optimistic version are required by the backend.
                  </p>
                </div>
                <Badge tone="warning" icon="shield">
                  Step-up protected
                </Badge>
              </div>
              <form
                className="detail-section quota-form"
                onSubmit={(event) => void setOverride(event)}
              >
                <div className="two-col-fields">
                  <Field label="Quota key">
                    <SelectInput
                      value={keyName}
                      onChange={(event) =>
                        setKeyName(event.target.value as (typeof quotaKeys)[number])
                      }
                    >
                      {quotaKeys.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Value">
                    <TextInput
                      type="number"
                      min={keyName === "quick_databases_total" ? "-1" : "0"}
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      required
                    />
                  </Field>
                </div>
                <div className="two-col-fields">
                  <Field label="Expires at" hint="Required by the typed quota contract.">
                    <TextInput
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(event) => setExpiresAt(event.target.value)}
                      required
                    />
                  </Field>
                  <Field
                    label="Expected version"
                    hint="Use 0 when the override is new; use the reported override version when replacing it."
                  >
                    <TextInput
                      type="number"
                      min="0"
                      value={expectedVersion}
                      onChange={(event) => setExpectedVersion(event.target.value)}
                      required
                    />
                  </Field>
                </div>
                <Field label="Reason">
                  <TextArea
                    value={reason}
                    onChange={(event) => setReason(event.target.value.slice(0, 500))}
                    minLength={3}
                    maxLength={500}
                    placeholder="Explain the temporary operational need"
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  icon="check"
                  loading={saving}
                  disabled={saving}
                >
                  Set typed override
                </Button>
              </form>
            </Card>
          ) : null}
        </div>
      ) : null}
      {clearKey ? (
        <ConfirmActionModal
          title="Clear quota override"
          target={`${orgId} · ${clearKey.key}`}
          description="This removes the typed organization override after the backend checks its current version."
          actionLabel="Clear override"
          reasonRequired={false}
          dangerous
          expectedVersion={clearKey.version}
          onConfirm={clear}
          onClose={() => setClearKey(null)}
        />
      ) : null}
    </>
  );
}

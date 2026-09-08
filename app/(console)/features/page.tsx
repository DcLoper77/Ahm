"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { useAdminQuery } from "@/lib/admin/hooks";
import { useAdminSession } from "@/components/auth/session-context";
import { ConfirmActionModal } from "@/components/confirm-action";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import {
  Badge,
  Button,
  Card,
  DataTable,
  PageHeader,
  StatusBadge,
  TableColumn,
} from "@/components/ui";
import type { AdminRecord } from "@/lib/admin/types";

function featureRows(data: AdminRecord | undefined): AdminRecord[] {
  if (!data) return [];
  const value = data.features ?? data.items;
  return Array.isArray(value)
    ? value.filter((item): item is AdminRecord => Boolean(item && typeof item === "object"))
    : [];
}

export default function FeaturesPage() {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.roles ?? [], "catalog.read");
  const canWrite = hasPermission(admin?.roles ?? [], "catalog.write");
  const query = useAdminQuery(["features"], (api) => api.catalogue.features(), {
    enabled: canRead,
  });
  const rows = featureRows(query.data?.data);
  const [pending, setPending] = useState<AdminRecord | null>(null);
  const columns = useMemo<TableColumn<AdminRecord>[]>(
    () => [
      {
        key: "feature",
        label: "Feature",
        render: (row) => (
          <span className="primary-cell">
            <span className="row-avatar">F</span>
            <span className="primary-cell-copy">
              <strong>{String(row.key ?? row.name ?? "Feature")}</strong>
              <small>
                {typeof row.description === "string"
                  ? row.description
                  : "Closed global feature set"}
              </small>
            </span>
          </span>
        ),
      },
      {
        key: "state",
        label: "State",
        render: (row) => (
          <StatusBadge
            value={
              row.enabled === true
                ? "ACTIVE"
                : row.enabled === false
                  ? "DISABLED"
                  : (row.state ?? "UNKNOWN")
            }
          />
        ),
      },
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
          const hasVersion = typeof row.version === "number" && row.version >= 1;
          const hasState = typeof row.enabled === "boolean";
          return canWrite && typeof row.key === "string" && hasVersion && hasState ? (
            <Button
              variant={row.enabled === true ? "danger-quiet" : "secondary"}
              onClick={() => setPending(row)}
            >
              {row.enabled === true ? "Disable" : "Enable"}
            </Button>
          ) : canWrite && typeof row.key === "string" ? (
            <Badge tone="warning">Waiting for version/state</Badge>
          ) : (
            <Badge tone="neutral">Read only</Badge>
          );
        },
      },
    ],
    [canWrite],
  );
  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Catalogue"
          title="Feature flags"
          description="Feature access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask for catalog.read to inspect the closed feature set."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Feature flags"
        description="Only the closed set returned by the admin API is shown. Changes are typed, version guarded, and step-up protected."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["features"] })}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Global product features</h2>
            <p>
              Disabling hosting blocks new hosting intent without deleting existing workload rows.
            </p>
          </div>
          <Badge tone="warning" icon="shield">
            Step-up protected
          </Badge>
        </div>
        {query.isLoading ? (
          <QueryLoading label="Loading feature flags…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length ? (
          <DataTable
            caption="Feature flags"
            rows={rows}
            rowKey={(row, index) => String(row.key ?? index)}
            columns={columns}
          />
        ) : (
          <QueryEmpty
            title="No feature flags reported"
            description="The admin API returned an empty closed feature set."
          />
        )}
      </Card>
      {pending ? (
        <FeatureDialog
          feature={pending}
          onClose={() => setPending(null)}
          onCompleted={() => {
            setPending(null);
            void queryClient.invalidateQueries({ queryKey: ["features"] });
          }}
          runMutation={runMutation}
        />
      ) : null}
    </>
  );
}

function FeatureDialog({
  feature,
  onClose,
  onCompleted,
  runMutation,
}: {
  feature: AdminRecord;
  onClose: () => void;
  onCompleted: () => void;
  runMutation: ReturnType<typeof useAdminSession>["runMutation"];
}) {
  const key = String(feature.key);
  const enabled = feature.enabled === true;
  const version =
    typeof feature.version === "number" && feature.version >= 1 ? feature.version : undefined;
  if (version === undefined || typeof feature.enabled !== "boolean") return null;
  return (
    <ConfirmActionModal
      title={`${enabled ? "Disable" : "Enable"} ${key}`}
      target={key}
      description="The backend checks the closed feature key, optimistic version, catalog authority, fresh MFA, and audit policy."
      actionLabel={enabled ? "Disable feature" : "Enable feature"}
      expectedVersion={version}
      reasonRequired
      dangerous={enabled}
      onConfirm={async (input) => {
        await runMutation({
          method: "PATCH",
          path: `/features/${encodeURIComponent(key)}`,
          body: {
            enabled: !enabled,
            expected_version: input.expected_version ?? version,
            reason: input.reason ?? "",
          },
          step_up_action: "admin:feature_flag",
        });
        onCompleted();
      }}
      onClose={onClose}
    />
  );
}

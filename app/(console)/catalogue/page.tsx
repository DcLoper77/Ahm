"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ApiResult } from "@/lib/admin/client";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate, humanize, isSensitiveKey, safeScalar } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { useAdminSession } from "@/components/auth/session-context";
import { ConfirmActionModal } from "@/components/confirm-action";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import { SafeRecordSummary } from "@/components/record-view";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Modal,
  ModalForm,
  PageHeader,
  StatusBadge,
  TableColumn,
  TextInput,
} from "@/components/ui";
import type {
  AdminRecord,
  CatalogueRevision,
  PlanDraftItem,
  PlanLimits,
  ServiceDraftItem,
} from "@/lib/admin/types";

type CatalogueKind = "plans" | "services" | "vps";

const limitKeys: (keyof PlanLimits)[] = [
  "storage_bytes",
  "projects",
  "team_members",
  "store_per_project",
  "kv_per_project",
  "box_per_project",
  "sql_per_project",
  "mongo_per_project",
  "cache_per_project",
  "backend_slots",
  "web_slots",
  "custom_domains",
  "build_minutes",
  "bandwidth_bytes",
  "api_requests_per_min",
  "deployment_history",
];
const defaultLimits = (): PlanLimits => ({
  storage_bytes: 0,
  projects: 0,
  team_members: 0,
  store_per_project: 0,
  kv_per_project: 0,
  box_per_project: 0,
  sql_per_project: 0,
  mongo_per_project: 0,
  cache_per_project: 0,
  backend_slots: 0,
  web_slots: 0,
  custom_domains: 0,
  build_minutes: 0,
  bandwidth_bytes: 0,
  api_requests_per_min: 0,
  deployment_history: 0,
});
const defaultPlans = (): PlanDraftItem[] =>
  ["free", "developer", "founder"].map((plan_key) => ({
    plan_key: plan_key as PlanDraftItem["plan_key"],
    display_name: plan_key.charAt(0).toUpperCase() + plan_key.slice(1),
    price: plan_key === "free" ? null : { usd_minor: 0, inr_minor: 0 },
    limits: defaultLimits(),
    log_retention_days: 0,
    backup_retention_days: 0,
  }));
const defaultServices = (): ServiceDraftItem[] => [
  {
    service_key: "web",
    service_type: "web",
    display_name: "Web",
    schema_version: "1",
    hard_ceiling_profile: "default",
    max_functions: 0,
    max_port: null,
    enabled: true,
  },
  {
    service_key: "backend",
    service_type: "backend",
    display_name: "Backend",
    schema_version: "1",
    hard_ceiling_profile: "default",
    max_functions: 0,
    max_port: 3000,
    enabled: true,
  },
];

function DraftDialog({
  kind,
  onClose,
  onCreated,
}: {
  kind: CatalogueKind;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { runMutation } = useAdminSession();
  const [plans, setPlans] = useState(defaultPlans);
  const [services, setServices] = useState(defaultServices);
  const [updatedBy, setUpdatedBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (kind === "plans")
        await runMutation({
          path: "/plans/versions",
          body: { plans },
          step_up_action: "admin:catalogue_draft",
        });
      else if (kind === "services")
        await runMutation({
          path: "/services/versions",
          body: { services },
          step_up_action: "admin:catalogue_draft",
        });
      else
        await runMutation({
          path: "/vps/versions",
          body: {
            catalog_version: 1,
            updated_at: new Date().toISOString(),
            updated_by: updatedBy || "Admin operator",
            defaults: {
              provider: "AIC",
              region: "default",
              currencies: ["INR", "USD"],
              operating_systems: [{ id: "linux", label: "Linux", default: true }],
              guards: {
                min_margin_bp: 0,
                warn_margin_bp: 0,
                require_cost: true,
                forbid_price_below_cost: true,
                gst_rate_bp: 1800,
              },
            },
            plans: [
              {
                sku: "standard",
                aic_plan_id: "standard",
                display_name: "Standard",
                roles: ["dedicated"],
                visible: true,
                orderable: false,
                specs: { vcpu: 1, ram_mb: 1024, disk_gb: 25, bandwidth_gb: 100 },
                cost: { inr_minor: 0 },
                price: { inr_minor: 0 },
              },
            ],
            plan_bundles: {
              free: { hosting_node: null, bundled_vps: [] },
              developer: { hosting_node: null, bundled_vps: [] },
              founder: { hosting_node: null, bundled_vps: [] },
            },
          },
          step_up_action: "admin:catalogue_draft",
        });
      onCreated();
      onClose();
    } catch (draftError) {
      setError(
        draftError instanceof Error ? draftError.message : "The typed draft could not be created.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal
      title={`Create ${kind} draft`}
      description="This form submits the strict typed catalogue schema. Unverified drafts never become runtime authority."
      onClose={loading ? () => undefined : onClose}
      size="large"
    >
      <ModalForm
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              Create unverified draft
            </Button>
          </>
        }
      >
        {error ? (
          <div className="inline-alert inline-alert-danger" role="alert">
            {error}
          </div>
        ) : null}
        {kind === "plans" ? (
          <div className="draft-form-grid">
            {plans.map((plan, planIndex) => (
              <div className="draft-group" key={plan.plan_key}>
                <div className="draft-group-heading">
                  <strong>{plan.plan_key}</strong>
                  <Badge tone="neutral">Typed plan</Badge>
                </div>
                <Field label="Display name">
                  <TextInput
                    value={plan.display_name}
                    onChange={(event) =>
                      setPlans((current) =>
                        current.map((item, index) =>
                          index === planIndex
                            ? { ...item, display_name: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </Field>
                <div className="two-col-fields">
                  <Field label="USD minor units">
                    <TextInput
                      type="number"
                      min="0"
                      value={plan.price?.usd_minor ?? 0}
                      disabled={plan.price === null}
                      onChange={(event) =>
                        setPlans((current) =>
                          current.map((item, index) =>
                            index === planIndex && item.price
                              ? {
                                  ...item,
                                  price: { ...item.price, usd_minor: Number(event.target.value) },
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="INR minor units">
                    <TextInput
                      type="number"
                      min="0"
                      value={plan.price?.inr_minor ?? 0}
                      disabled={plan.price === null}
                      onChange={(event) =>
                        setPlans((current) =>
                          current.map((item, index) =>
                            index === planIndex && item.price
                              ? {
                                  ...item,
                                  price: { ...item.price, inr_minor: Number(event.target.value) },
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <div className="two-col-fields">
                  <Field label="Log retention days">
                    <TextInput
                      type="number"
                      min="0"
                      max="30"
                      value={plan.log_retention_days}
                      onChange={(event) =>
                        setPlans((current) =>
                          current.map((item, index) =>
                            index === planIndex
                              ? { ...item, log_retention_days: Number(event.target.value) }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Backup retention days">
                    <TextInput
                      type="number"
                      min="0"
                      max="30"
                      value={plan.backup_retention_days ?? 0}
                      onChange={(event) =>
                        setPlans((current) =>
                          current.map((item, index) =>
                            index === planIndex
                              ? { ...item, backup_retention_days: Number(event.target.value) }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <details className="typed-details">
                  <summary>Plan limits</summary>
                  <div className="limit-grid">
                    {limitKeys.map((key) => (
                      <Field key={key} label={String(key).replaceAll("_", " ")}>
                        <TextInput
                          type="number"
                          min="0"
                          value={plan.limits[key] ?? 0}
                          onChange={(event) =>
                            setPlans((current) =>
                              current.map((item, index) =>
                                index === planIndex
                                  ? {
                                      ...item,
                                      limits: { ...item.limits, [key]: Number(event.target.value) },
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        ) : kind === "services" ? (
          <div className="draft-form-grid">
            {services.map((service, index) => (
              <div className="draft-group" key={service.service_key}>
                <div className="draft-group-heading">
                  <strong>{service.service_key}</strong>
                  <Badge tone={service.enabled ? "success" : "neutral"}>
                    {service.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Field label="Display name">
                  <TextInput
                    value={service.display_name}
                    onChange={(event) =>
                      setServices((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, display_name: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </Field>
                <div className="two-col-fields">
                  <Field label="Schema version">
                    <TextInput
                      value={service.schema_version}
                      onChange={(event) =>
                        setServices((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, schema_version: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Ceiling profile">
                    <TextInput
                      value={service.hard_ceiling_profile}
                      onChange={(event) =>
                        setServices((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, hard_ceiling_profile: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <div className="two-col-fields">
                  <Field label="Max functions">
                    <TextInput
                      type="number"
                      min="0"
                      max="5"
                      value={service.max_functions}
                      onChange={(event) =>
                        setServices((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, max_functions: Number(event.target.value) }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Max port">
                    <TextInput
                      type="number"
                      min="1024"
                      max="65535"
                      value={service.max_port ?? ""}
                      onChange={(event) =>
                        setServices((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  max_port: event.target.value ? Number(event.target.value) : null,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={service.enabled}
                    onChange={(event) =>
                      setServices((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, enabled: event.target.checked } : item,
                        ),
                      )
                    }
                  />{" "}
                  Available for new intent
                </label>
              </div>
            ))}
          </div>
        ) : (
          <>
            <Field label="Updated by" hint="Recorded in the typed draft metadata.">
              <TextInput
                value={updatedBy}
                onChange={(event) => setUpdatedBy(event.target.value)}
                placeholder="Admin operator"
                maxLength={100}
              />
            </Field>
            <p className="security-note">
              The VPS draft form starts from the strict defaults exposed by the contract. Populate
              provider-specific values through the typed fields before asking the backend to
              validate parity.
            </p>
          </>
        )}
      </ModalForm>
    </Modal>
  );
}

export default function CataloguePage() {
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CatalogueKind>("plans");
  const [draftOpen, setDraftOpen] = useState(false);
  const [diffRevision, setDiffRevision] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    action: "validate" | "publish" | "retire";
    revision: CatalogueRevision;
  } | null>(null);
  const canRead = hasPermission(admin?.roles ?? [], "catalog.read");
  const canWrite = hasPermission(admin?.roles ?? [], "catalog.write");
  const canPublish = hasPermission(admin?.roles ?? [], "catalog.publish");
  const query = useAdminQuery(["catalogue", kind], (api) => api.catalogue.revisions(kind), {
    enabled: canRead,
  });
  const activeServiceQuery = useAdminQuery(
    ["catalogue", "active-services"],
    (api) => api.catalogue.activeServices(),
    { enabled: canRead && kind === "services" },
  );
  const diffQuery = useAdminQuery(
    ["catalogue", kind, "diff", diffRevision],
    (api) => api.catalogue.diff(kind, diffRevision ?? 0),
    { enabled: canRead && diffRevision !== null },
  );
  const revisions = query.data?.data.revisions ?? [];
  const columns = useMemo<TableColumn<CatalogueRevision>[]>(
    () => [
      {
        key: "revision",
        label: "Revision",
        render: (revision) => (
          <span className="primary-cell">
            <span className="row-avatar">{revision.revision}</span>
            <span className="primary-cell-copy">
              <strong>Revision {revision.revision}</strong>
              <small>{revision.id}</small>
            </span>
          </span>
        ),
      },
      {
        key: "state",
        label: "State",
        render: (revision) => <StatusBadge value={revision.state} />,
      },
      {
        key: "parity",
        label: "Parity",
        render: (revision) => <StatusBadge value={revision.parity_state} />,
      },
      {
        key: "version",
        label: "Version",
        render: (revision) => <span className="mono">v{revision.version}</span>,
      },
      { key: "updated", label: "Updated", render: (revision) => formatDate(revision.updated_at) },
      {
        key: "actions",
        label: "Actions",
        align: "right",
        render: (revision) => (
          <div className="action-row table-action-row">
            <Button variant="quiet" onClick={() => setDiffRevision(revision.revision)}>
              View diff
            </Button>
            {revision.state === "DRAFT" && canWrite ? (
              <Button
                variant="quiet"
                onClick={() => setPendingAction({ action: "validate", revision })}
              >
                Validate
              </Button>
            ) : null}
            {revision.state === "DRAFT" && canPublish ? (
              <Button
                variant="primary"
                onClick={() => setPendingAction({ action: "publish", revision })}
              >
                Publish
              </Button>
            ) : null}
            {revision.state === "PUBLISHED" && canPublish ? (
              <Button
                variant="danger-quiet"
                onClick={() => setPendingAction({ action: "retire", revision })}
              >
                Retire
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canPublish, canWrite],
  );
  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Catalogue"
          title="Plans & services"
          description="Catalogue access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask a platform administrator for catalog.read to inspect revisions."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Plans & services"
        description="Typed, immutable revisions with parity state, version guards, and explicit publication evidence."
        actions={
          <>
            <Button
              variant="secondary"
              icon="refresh"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ["catalogue", kind] })}
              loading={query.isFetching}
            >
              Refresh
            </Button>
            {canWrite ? (
              <Button variant="primary" icon="plus" onClick={() => setDraftOpen(true)}>
                Create typed draft
              </Button>
            ) : null}
          </>
        }
      />
      <div className="tabs">
        {(["plans", "services", "vps"] as CatalogueKind[]).map((item) => (
          <button
            key={item}
            className={`tab ${kind === item ? "is-active" : ""}`}
            onClick={() => setKind(item)}
          >
            {item === "plans" ? "Plans" : item === "services" ? "Hosting services" : "HavenVPS"}
          </button>
        ))}
      </div>
      <Card>
        <div className="card-heading">
          <div>
            <h2>
              {kind === "plans"
                ? "Plan revisions"
                : kind === "services"
                  ? "Service revisions"
                  : "VPS catalogue revisions"}
            </h2>
            <p>
              Unverified drafts stay outside runtime authority until validation, parity, and guarded
              publication succeed.
            </p>
          </div>
          <Badge tone="info" icon="layers">
            Immutable revisions
          </Badge>
        </div>
        {query.isLoading ? (
          <QueryLoading label="Loading catalogue revisions…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : revisions.length ? (
          <DataTable
            caption={`${kind} catalogue revisions`}
            rows={revisions}
            rowKey={(revision) => revision.id}
            columns={columns}
          />
        ) : (
          <QueryEmpty
            title="No revisions reported"
            description="The admin API returned no catalogue revisions for this family."
          />
        )}
      </Card>
      <div className="catalogue-note">
        <Badge tone="warning" icon="shield">
          Publication guard
        </Badge>
        <span>
          {canPublish
            ? "Your role may publish after fresh MFA and validation."
            : "Publication and retirement are root protected by the final permission model."}
        </span>
      </div>
      {kind === "services" ? (
        <Card className="active-catalogue-card">
          <div className="card-heading">
            <div>
              <h2>Active service catalogue</h2>
              <p>Runtime authority is read from the dedicated active catalogue projection.</p>
            </div>
            <Badge tone="success" icon="check-circle">
              Active view
            </Badge>
          </div>
          {activeServiceQuery.isLoading ? (
            <QueryLoading label="Loading active catalogue…" />
          ) : activeServiceQuery.error ? (
            <QueryError
              error={activeServiceQuery.error}
              onRetry={() => void activeServiceQuery.refetch()}
            />
          ) : activeServiceQuery.data?.data ? (
            <SafeRecordSummary record={activeServiceQuery.data.data} />
          ) : (
            <QueryEmpty
              title="No active catalogue reported"
              description="The admin API did not return the active service catalogue."
            />
          )}
        </Card>
      ) : null}
      {draftOpen ? (
        <DraftDialog
          kind={kind}
          onClose={() => setDraftOpen(false)}
          onCreated={() => void queryClient.invalidateQueries({ queryKey: ["catalogue", kind] })}
        />
      ) : null}
      {pendingAction ? (
        <CatalogueActionDialog
          kind={kind}
          pendingAction={pendingAction}
          onClose={() => setPendingAction(null)}
          onCompleted={() => {
            setPendingAction(null);
            void queryClient.invalidateQueries({ queryKey: ["catalogue", kind] });
          }}
        />
      ) : null}
      {diffRevision !== null ? (
        <DiffDialog
          revision={diffRevision}
          query={diffQuery}
          onClose={() => setDiffRevision(null)}
        />
      ) : null}
    </>
  );
}

function DiffDialog({
  revision,
  query,
  onClose,
}: {
  revision: number;
  query: ReturnType<typeof useAdminQuery<ApiResult<AdminRecord>>>;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`Revision ${revision} diff`}
      description="The comparison is read-only and redacts secret-adjacent keys from the rendered view."
      onClose={onClose}
      size="large"
    >
      <div className="modal-body">
        {query.isLoading ? (
          <QueryLoading label="Loading revision diff…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data?.data ? (
          <SafeDiff value={query.data.data} />
        ) : (
          <QueryEmpty
            title="No diff reported"
            description="The admin API returned no diff payload for this revision."
          />
        )}
      </div>
      <div className="modal-footer">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

function SafeDiff({ value, path = "root" }: { value: unknown; path?: string }): React.ReactNode {
  if (Array.isArray(value)) {
    return (
      <div className="safe-diff-node">
        <span className="safe-diff-label">{humanize(path)}</span>
        <strong>{value.length} items</strong>
        {value.slice(0, 8).map((item, index) => (
          <div className="safe-diff-child" key={`${path}-${index}`}>
            {SafeDiff({ value: item, path: `${path}.${index + 1}` })}
          </div>
        ))}
      </div>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="safe-diff-node">
        {Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !isSensitiveKey(key))
          .slice(0, 30)
          .map(([key, child]) => (
            <div className="safe-diff-child" key={`${path}-${key}`}>
              {SafeDiff({ value: child, path: key })}
            </div>
          ))}
      </div>
    );
  }
  const scalar = safeScalar(value);
  return (
    <div className="safe-diff-row">
      <span>{humanize(path)}</span>
      <strong>{scalar === null ? "Not reported" : String(scalar)}</strong>
    </div>
  );
}

function CatalogueActionDialog({
  kind,
  pendingAction,
  onClose,
  onCompleted,
}: {
  kind: CatalogueKind;
  pendingAction: { action: "validate" | "publish" | "retire"; revision: CatalogueRevision };
  onClose: () => void;
  onCompleted: () => void;
}) {
  const { runMutation } = useAdminSession();
  const submit = async (input: { expected_version?: number; reason?: string }) => {
    await runMutation({
      path: `/${kind}/versions/${pendingAction.revision.revision}:${pendingAction.action}`,
      body: { expected_version: input.expected_version ?? pendingAction.revision.version },
      step_up_action: `admin:catalogue_${pendingAction.action}`,
    });
    onCompleted();
  };
  return (
    <ConfirmActionModal
      title={`${pendingAction.action.charAt(0).toUpperCase() + pendingAction.action.slice(1)} catalogue revision`}
      target={`${kind} revision ${pendingAction.revision.revision}`}
      description="The backend checks parity, version, role, and fresh MFA before changing catalogue authority."
      actionLabel={pendingAction.action}
      expectedVersion={pendingAction.revision.version}
      reasonRequired={pendingAction.action !== "validate"}
      dangerous={pendingAction.action === "retire" || pendingAction.action === "publish"}
      onConfirm={submit}
      onClose={onClose}
    />
  );
}

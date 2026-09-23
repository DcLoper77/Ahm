"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  InlineAlert,
  Modal,
  ModalForm,
  PageHeader,
  StatusBadge,
  TableColumn,
  TextInput,
} from "@/components/ui";
import { formatDate, formatMoneyMinor } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { hasPermission } from "@/lib/admin/rbac";
import type { ApiResult } from "@/lib/admin/client";
import type {
  ActiveProductCatalogue,
  AddonDraftItem,
  AdminRecord,
  CatalogueActionResult,
  CatalogueRevision,
  PlanDraftItem,
  PlanLimits,
} from "@/lib/admin/types";

const editableLimitKeys: (keyof PlanLimits)[] = [
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
];

const editableLimitLabels: Partial<Record<keyof PlanLimits, string>> = {
  storage_bytes: "Shared storage (bytes)",
  backup_manual_retained: "Retained manual backups",
  projects: "Projects",
  team_members: "Team members",
  store_per_project: "HavenStore per project",
  kv_per_project: "HavenKV per project",
  box_per_project: "HavenBox buckets per project",
  sql_per_project: "HavenSQL per project",
  mongo_per_project: "HavenMongo per project",
  cache_per_project: "HavenCache per project",
  quick_databases_total: "Quick Databases per organization",
  quick_databases_redis: "Redis Quick Databases per organization",
  api_requests_per_min: "API requests per minute",
};

function cloneCatalogue(source: ActiveProductCatalogue): {
  plans: PlanDraftItem[];
  addons: AddonDraftItem[];
} {
  return {
    plans: source.plans.map((plan) => ({
      ...plan,
      price: plan.price ? { ...plan.price } : null,
      limits: { ...plan.limits },
    })),
    addons: source.addons.map((addon) => ({
      ...addon,
      price: { ...addon.price },
      available_on: [...addon.available_on],
    })),
  };
}

function numberValue(value: string): number {
  return value === "" ? 0 : Number(value);
}

function ProductPrice({ price }: { price: { usd_minor: number; inr_minor: number } | null }) {
  if (!price) return <span>Free</span>;
  return (
    <span className="price-pair">
      <strong>{formatMoneyMinor(price.usd_minor, "usd")}</strong>
      <small>{formatMoneyMinor(price.inr_minor, "inr")}</small>
    </span>
  );
}

function CatalogueDraftDialog({
  active,
  onClose,
  onCreated,
}: {
  active: ActiveProductCatalogue;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { runMutation } = useAdminSession();
  const [draft, setDraft] = useState(() => cloneCatalogue(active));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updatePlan = (planIndex: number, update: (plan: PlanDraftItem) => PlanDraftItem) => {
    setDraft((current) => ({
      ...current,
      plans: current.plans.map((plan, index) => (index === planIndex ? update(plan) : plan)),
    }));
  };

  const updateAddon = (addonIndex: number, update: (addon: AddonDraftItem) => AddonDraftItem) => {
    setDraft((current) => ({
      ...current,
      addons: current.addons.map((addon, index) => (index === addonIndex ? update(addon) : addon)),
    }));
  };

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await runMutation({
        path: "/plans/versions",
        body: draft,
        step_up_action: "admin:catalogue_draft",
      });
      onCreated();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The billing catalogue draft could not be created.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Create billing catalogue draft"
      description="Start from the active server catalogue. A validated publication changes future purchases; existing invoice and subscription-item prices stay fixed."
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
              Create draft
            </Button>
          </>
        }
      >
        {error ? (
          <InlineAlert tone="danger" title="Draft not created">
            {error}
          </InlineAlert>
        ) : null}

        <section className="catalogue-editor-section" aria-labelledby="plan-price-heading">
          <div className="section-heading">
            <div>
              <h3 id="plan-price-heading">Managed data plans</h3>
              <p>
                Paid prices use integer USD cents and INR paise. Founder price is fixed by the
                current product contract.
              </p>
            </div>
            <Badge tone="neutral">
              {active.authority === "database"
                ? `Active revision ${active.revision ?? "—"}`
                : "Code catalogue"}
            </Badge>
          </div>
          <div className="draft-form-grid">
            {draft.plans.map((plan, planIndex) => (
              <Card className="catalogue-product-card" key={plan.plan_key}>
                <div className="draft-group-heading">
                  <div>
                    <strong>{plan.display_name}</strong>
                    <small className="mono">{plan.plan_key}</small>
                  </div>
                  <ProductPrice price={plan.price} />
                </div>
                <Field label="Display name">
                  <TextInput
                    value={plan.display_name}
                    onChange={(event) =>
                      updatePlan(planIndex, (current) => ({
                        ...current,
                        display_name: event.target.value,
                      }))
                    }
                    maxLength={100}
                  />
                </Field>
                <div className="two-col-fields">
                  <Field label="USD cents" hint="Minor units; 700 = $7.00">
                    <TextInput
                      type="number"
                      min="1"
                      step="1"
                      value={plan.price?.usd_minor ?? 0}
                      disabled={plan.price === null || plan.plan_key === "founder"}
                      onChange={(event) =>
                        updatePlan(planIndex, (current) =>
                          current.price
                            ? {
                                ...current,
                                price: {
                                  ...current.price,
                                  usd_minor: numberValue(event.target.value),
                                },
                              }
                            : current,
                        )
                      }
                    />
                  </Field>
                  <Field label="INR paise" hint="Minor units; 65900 = ₹659.00">
                    <TextInput
                      type="number"
                      min="1"
                      step="1"
                      value={plan.price?.inr_minor ?? 0}
                      disabled={plan.price === null || plan.plan_key === "founder"}
                      onChange={(event) =>
                        updatePlan(planIndex, (current) =>
                          current.price
                            ? {
                                ...current,
                                price: {
                                  ...current.price,
                                  inr_minor: numberValue(event.target.value),
                                },
                              }
                            : current,
                        )
                      }
                    />
                  </Field>
                </div>
                {plan.plan_key === "founder" ? (
                  <p className="security-note">
                    Founder pricing is fixed at{" "}
                    {formatMoneyMinor(plan.price?.usd_minor ?? 0, "usd")} /{" "}
                    {formatMoneyMinor(plan.price?.inr_minor ?? 0, "inr")} by the product design.
                  </p>
                ) : null}
                <div className="two-col-fields">
                  <Field label="Backup retention (days)">
                    <TextInput
                      type="number"
                      min="0"
                      max="30"
                      value={plan.backup_retention_days ?? 0}
                      onChange={(event) =>
                        updatePlan(planIndex, (current) => ({
                          ...current,
                          backup_retention_days: numberValue(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Manual backups retained">
                    <TextInput
                      type="number"
                      min="0"
                      value={plan.limits.backup_manual_retained}
                      onChange={(event) =>
                        updatePlan(planIndex, (current) => ({
                          ...current,
                          limits: {
                            ...current.limits,
                            backup_manual_retained: numberValue(event.target.value),
                          },
                        }))
                      }
                    />
                  </Field>
                </div>
                <details className="typed-details">
                  <summary>Entitlements and admission limits</summary>
                  <div className="limit-grid">
                    {editableLimitKeys.map((key) => (
                      <Field key={key} label={editableLimitLabels[key] ?? key}>
                        <TextInput
                          type="number"
                          min={key === "quick_databases_total" ? "-1" : "0"}
                          step="1"
                          value={plan.limits[key]}
                          onChange={(event) =>
                            updatePlan(planIndex, (current) => ({
                              ...current,
                              limits: { ...current.limits, [key]: numberValue(event.target.value) },
                            }))
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </details>
              </Card>
            ))}
          </div>
        </section>

        <section className="catalogue-editor-section" aria-labelledby="addon-price-heading">
          <div className="section-heading">
            <div>
              <h3 id="addon-price-heading">Recurring add-ons</h3>
              <p>
                New add-on checkouts use these prices. Existing paid add-on items retain their
                purchase-time price.
              </p>
            </div>
            <Badge tone="info">Billed with subscription</Badge>
          </div>
          <div className="draft-form-grid">
            {draft.addons.map((addon, addonIndex) => (
              <Card className="catalogue-product-card" key={addon.addon_code}>
                <div className="draft-group-heading">
                  <div>
                    <strong>{addon.display_name}</strong>
                    <small className="mono">{addon.addon_code}</small>
                  </div>
                  <ProductPrice price={addon.price} />
                </div>
                <div className="two-col-fields">
                  <Field label="USD cents" hint="Minor units">
                    <TextInput
                      type="number"
                      min="1"
                      step="1"
                      value={addon.price.usd_minor}
                      onChange={(event) =>
                        updateAddon(addonIndex, (current) => ({
                          ...current,
                          price: { ...current.price, usd_minor: numberValue(event.target.value) },
                        }))
                      }
                    />
                  </Field>
                  <Field label="INR paise" hint="Minor units">
                    <TextInput
                      type="number"
                      min="1"
                      step="1"
                      value={addon.price.inr_minor}
                      onChange={(event) =>
                        updateAddon(addonIndex, (current) => ({
                          ...current,
                          price: { ...current.price, inr_minor: numberValue(event.target.value) },
                        }))
                      }
                    />
                  </Field>
                </div>
                <div className="addon-policy">
                  <span>Available on {addon.available_on.join(" and ")}</span>
                  <span>Maximum {addon.max_units} units</span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </ModalForm>
    </Modal>
  );
}

export default function CataloguePage() {
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "catalog.read");
  const canWrite = hasPermission(admin?.permissions ?? [], "catalog.write");
  const canPublish = hasPermission(admin?.permissions ?? [], "catalog.publish");
  const [draftOpen, setDraftOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: "validate" | "publish" | "retire";
    revision: CatalogueRevision;
  } | null>(null);
  const [diffRevisionId, setDiffRevisionId] = useState<string | null>(null);
  const [viewRevisionId, setViewRevisionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    requestId?: string;
    warning?: boolean;
  } | null>(null);
  const query = useAdminQuery(["catalogue", "plans"], (api) => api.catalogue.revisions(), {
    enabled: canRead,
  });
  const diffQuery = useAdminQuery(
    ["catalogue", "plans", "diff", diffRevisionId],
    (api) => api.catalogue.diff(diffRevisionId ?? ""),
    { enabled: canRead && diffRevisionId !== null },
  );
  const revisions = query.data?.data.revisions ?? [];
  const activeCatalogue = query.data?.data.active_catalogue;
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
              <small className="mono">{revision.id}</small>
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
        label: "Validation",
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
            <Button variant="quiet" onClick={() => setDiffRevisionId(revision.id)}>
              View diff
            </Button>
            <Button variant="quiet" onClick={() => setViewRevisionId(revision.id)}>
              View definition
            </Button>
            {revision.state === "DRAFT" && canWrite ? (
              <Button
                variant="quiet"
                onClick={() => setPendingAction({ action: "validate", revision })}
              >
                Validate
              </Button>
            ) : null}
            {revision.state === "DRAFT" && canPublish && revision.parity_state === "VERIFIED" ? (
              <Button
                variant="primary"
                onClick={() => setPendingAction({ action: "publish", revision })}
              >
                Publish
              </Button>
            ) : null}
            {revision.state === "DRAFT" && canWrite ? (
              <Button
                variant="danger-quiet"
                onClick={() => setPendingAction({ action: "retire", revision })}
              >
                Retire draft
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canPublish, canWrite],
  );

  if (!canRead) {
    return (
      <>
        <PageHeader
          eyebrow="Catalogue"
          title="Plans & add-ons"
          description="Catalogue access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask for catalog.read to inspect product prices and entitlements."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Plans & add-ons"
        description="Versioned product prices and limits. Publishing affects new purchases; existing subscription items and invoices keep their purchase-time snapshots."
        actions={
          <>
            <Button
              variant="secondary"
              icon="refresh"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ["catalogue"] })}
              loading={query.isFetching}
            >
              Refresh
            </Button>
            {canWrite ? (
              <Button
                variant="primary"
                icon="plus"
                onClick={() => setDraftOpen(true)}
                disabled={!activeCatalogue}
              >
                Create draft from active catalogue
              </Button>
            ) : null}
          </>
        }
      />
      {notice ? (
        <InlineAlert
          tone={notice.warning ? "warning" : "success"}
          title={notice.warning ? "Publication queued" : "Catalogue updated"}
          onDismiss={() => setNotice(null)}
        >
          {notice.message}
          {notice.requestId ? (
            <span className="notice-request">Request {notice.requestId}</span>
          ) : null}
        </InlineAlert>
      ) : null}
      {query.isLoading ? (
        <QueryLoading label="Loading active catalogue and revisions…" />
      ) : query.error ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {activeCatalogue && !query.error ? (
        <>
          <Card>
            <div className="card-heading">
              <div>
                <h2>Effective prices</h2>
                <p>
                  Source:{" "}
                  {activeCatalogue.authority === "database"
                    ? `published revision ${activeCatalogue.revision ?? "—"}`
                    : "code catalogue"}
                </p>
              </div>
              <Badge tone={activeCatalogue.authority === "database" ? "success" : "neutral"}>
                {activeCatalogue.authority === "database" ? "Database authority" : "Code authority"}
              </Badge>
            </div>
            <DataTable
              caption="Current product prices"
              rows={[
                ...activeCatalogue.plans.map((plan) => ({
                  id: plan.plan_key,
                  product: plan.display_name,
                  family: "Plan",
                  price: plan.price,
                  policy:
                    plan.plan_key === "founder"
                      ? "Fixed by product design"
                      : plan.plan_key === "free"
                        ? "No charge"
                        : "New subscriptions and upgrades",
                })),
                ...activeCatalogue.addons.map((addon) => ({
                  id: addon.addon_code,
                  product: addon.display_name,
                  family: "Recurring add-on",
                  price: addon.price,
                  policy: "New purchases; current items keep their price",
                })),
              ]}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "product",
                  label: "Product",
                  render: (row) => <strong>{row.product}</strong>,
                },
                {
                  key: "family",
                  label: "Type",
                  render: (row) => <Badge tone="neutral">{row.family}</Badge>,
                },
                {
                  key: "price",
                  label: "USD / INR monthly",
                  render: (row) => <ProductPrice price={row.price} />,
                },
                { key: "policy", label: "Effective for", render: (row) => row.policy },
              ]}
            />
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <h2>Revision history</h2>
                <p>
                  Drafts must validate and pass server parity checks before guarded publication.
                </p>
              </div>
              <Badge tone="info" icon="layers">
                Immutable revisions
              </Badge>
            </div>
            {revisions.length ? (
              <DataTable
                caption="Billing catalogue revisions"
                rows={revisions}
                rowKey={(revision) => revision.id}
                columns={columns}
              />
            ) : (
              <QueryEmpty
                title="No catalogue revisions"
                description="The active code catalogue remains available. Create a draft from it to start a reviewed price change."
              />
            )}
          </Card>
        </>
      ) : null}
      {draftOpen && activeCatalogue ? (
        <CatalogueDraftDialog
          active={activeCatalogue}
          onClose={() => setDraftOpen(false)}
          onCreated={() => void queryClient.invalidateQueries({ queryKey: ["catalogue"] })}
        />
      ) : null}
      {pendingAction ? (
        <CatalogueActionDialog
          pendingAction={pendingAction}
          onClose={() => setPendingAction(null)}
          onCompleted={(result) => {
            setPendingAction(null);
            void queryClient.invalidateQueries({ queryKey: ["catalogue"] });
            if (result)
              setNotice({
                message:
                  result.runtime_activation === "PENDING"
                    ? "The validated revision is published. Runtime activation is pending; the current price remains visible until the committed catalogue reload completes."
                    : "The catalogue revision completed its guarded action.",
                requestId: result.request_id,
                warning: result.runtime_activation === "PENDING",
              });
          }}
        />
      ) : null}
      {diffRevisionId ? (
        <DiffDialog
          revisionId={diffRevisionId}
          query={diffQuery}
          onClose={() => setDiffRevisionId(null)}
        />
      ) : null}
      {viewRevisionId ? (
        <RevisionDefinitionDialog
          revisionId={viewRevisionId}
          onClose={() => setViewRevisionId(null)}
        />
      ) : null}
    </>
  );
}

function DiffDialog({
  revisionId,
  query,
  onClose,
}: {
  revisionId: string;
  query: ReturnType<typeof useAdminQuery<ApiResult<AdminRecord>>>;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Billing catalogue diff"
      description={`Revision ${revisionId}; historical and current prices are shown in minor units.`}
      onClose={onClose}
      size="large"
    >
      <div className="modal-body">
        {query.isLoading ? (
          <QueryLoading label="Loading revision diff…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data ? (
          <SafeRecordSummary record={query.data.data} />
        ) : (
          <QueryEmpty
            title="No diff returned"
            description="The backend did not return a diff for this revision."
          />
        )}
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

function RevisionDefinitionDialog({
  revisionId,
  onClose,
}: {
  revisionId: string;
  onClose: () => void;
}) {
  const query = useAdminQuery(["catalogue", "plans", "revision", revisionId], (api) =>
    api.catalogue.revision(revisionId),
  );
  const definition = query.data?.data.definition;
  return (
    <Modal
      title="Plan catalogue definition"
      description={`Immutable revision ${revisionId}.`}
      onClose={onClose}
      size="large"
    >
      <div className="modal-body">
        {query.isLoading ? (
          <QueryLoading label="Loading revision definition…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : definition ? (
          <div className="stack">
            <DataTable
              caption="Plan prices in revision"
              rows={definition.plans}
              rowKey={(plan) => plan.plan_key}
              columns={[
                {
                  key: "plan",
                  label: "Plan",
                  render: (plan) => (
                    <>
                      <strong>{plan.display_name}</strong>
                      <small className="mono">{plan.plan_key}</small>
                    </>
                  ),
                },
                {
                  key: "price",
                  label: "USD / INR",
                  render: (plan) => <ProductPrice price={plan.price} />,
                },
                {
                  key: "backup",
                  label: "Backup retention",
                  render: (plan) =>
                    plan.backup_retention_days === null
                      ? "Not included"
                      : `${plan.backup_retention_days} days`,
                },
              ]}
            />
            <DataTable
              caption="Add-on prices in revision"
              rows={definition.addons}
              rowKey={(addon) => addon.addon_code}
              columns={[
                {
                  key: "addon",
                  label: "Add-on",
                  render: (addon) => (
                    <>
                      <strong>{addon.display_name}</strong>
                      <small className="mono">{addon.addon_code}</small>
                    </>
                  ),
                },
                {
                  key: "price",
                  label: "USD / INR",
                  render: (addon) => <ProductPrice price={addon.price} />,
                },
                {
                  key: "availability",
                  label: "Available on",
                  render: (addon) => addon.available_on.join(", "),
                },
              ]}
            />
            <p className="security-note">
              Add-on names, availability, and entitlement rules remain code-owned. These prices
              apply to future purchases only.
            </p>
          </div>
        ) : (
          <QueryEmpty
            title="No definition returned"
            description="The revision detail route returned no product definition."
          />
        )}
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

function CatalogueActionDialog({
  pendingAction,
  onClose,
  onCompleted,
}: {
  pendingAction: { action: "validate" | "publish" | "retire"; revision: CatalogueRevision };
  onClose: () => void;
  onCompleted: (result?: {
    runtime_activation?: "ACTIVE" | "PENDING";
    request_id?: string;
  }) => void;
}) {
  const { runMutation } = useAdminSession();
  const submit = async (input: { expected_version?: number }) => {
    const response = await runMutation<CatalogueActionResult>({
      path: `/plans/versions/${encodeURIComponent(pendingAction.revision.id)}:${pendingAction.action}`,
      body: { expected_version: input.expected_version ?? pendingAction.revision.version },
      step_up_action: `admin:catalogue_${pendingAction.action}`,
    });
    onCompleted({
      runtime_activation: response.data.runtime_activation,
      request_id: response.request_id,
    });
  };
  return (
    <ConfirmActionModal
      title={`${pendingAction.action.charAt(0).toUpperCase() + pendingAction.action.slice(1)} billing catalogue revision`}
      target={`Revision ${pendingAction.revision.revision} (${pendingAction.revision.id})`}
      description={
        pendingAction.action === "publish"
          ? "The backend rechecks the complete plan/add-on catalogue, version, role, and fresh MFA. Existing billing snapshots are not repriced."
          : "The backend checks parity, version, role, and fresh MFA before changing catalogue state."
      }
      actionLabel={pendingAction.action}
      expectedVersion={pendingAction.revision.version}
      reasonRequired={false}
      dangerous={pendingAction.action !== "validate"}
      onConfirm={submit}
      onClose={onClose}
    />
  );
}

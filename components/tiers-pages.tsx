"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmActionModal } from "@/components/confirm-action";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import { SafeRecordSummary } from "@/components/record-view";
import { useAdminSession } from "@/components/auth/session-context";
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
  SelectInput,
  StatusBadge,
  TableColumn,
  TextArea,
  TextInput,
} from "@/components/ui";
import { formatDate, formatMoneyMinor, humanize } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { hasPermission } from "@/lib/admin/rbac";
import type {
  AdminRecord,
  CustomTierDraftBody,
  CustomTierSummary,
  TierAssignmentSummary,
  TierRevision,
} from "@/lib/admin/types";

const editableTierLimits = [
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

type TierAction = "validate" | "publish" | "archive";

function displayedTierPrice(tier: Pick<CustomTierSummary, "price_usd_minor" | "price_inr_minor">) {
  if (tier.price_usd_minor === 0 && tier.price_inr_minor === 0) return "No-charge grant";
  return `${formatMoneyMinor(tier.price_usd_minor, "usd")} / ${formatMoneyMinor(tier.price_inr_minor, "inr")}`;
}

function revisionLimits(revision: TierRevision | undefined) {
  return editableTierLimits.flatMap((key) => {
    const value = revision?.limits[key];
    return value === undefined || value === null
      ? []
      : [
          {
            key,
            value: key === "quick_databases_total" && value === -1 ? "Unlimited" : String(value),
          },
        ];
  });
}

export function CustomTiersPage() {
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "tiers.read");
  const canWrite = hasPermission(admin?.permissions ?? [], "tiers.write");
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useAdminQuery(["tiers"], (api) => api.tiers.list(), { enabled: canRead });
  const rows = (query.data?.data.tiers ?? []).filter((tier) => tier.system !== true);
  const columns = useMemo<TableColumn<CustomTierSummary>[]>(
    () => [
      {
        key: "name",
        label: "Custom grant",
        render: (tier) => (
          <Link href={`/tiers/${encodeURIComponent(tier.id)}`} className="primary-cell">
            <span className="row-avatar">G</span>
            <span className="primary-cell-copy">
              <strong>{tier.name}</strong>
              <small className="mono">{tier.key}</small>
            </span>
          </Link>
        ),
      },
      { key: "state", label: "State", render: (tier) => <StatusBadge value={tier.state} /> },
      {
        key: "duration",
        label: "Default duration",
        render: (tier) =>
          tier.default_duration_days ? `${tier.default_duration_days} days` : "Not set",
      },
      {
        key: "price",
        label: "Presentation price",
        render: (tier) => <span>{displayedTierPrice(tier)}</span>,
      },
      {
        key: "assignments",
        label: "Active grants",
        align: "right",
        render: (tier) => String(tier.active_assignment_count ?? tier.assignment_count ?? 0),
      },
      { key: "updated", label: "Updated", render: (tier) => formatDate(tier.updated_at) },
    ],
    [],
  );

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Catalogue" title="Custom tiers" />
        <QueryEmpty
          title="Permission required"
          description="Your role does not include tiers.read."
        />
      </>
    );

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Custom tiers"
        description="Versioned entitlement bundles for explicit, time-bound no-charge grants. Display prices are reference values and never enter billing."
        actions={
          <>
            <Button
              variant="secondary"
              icon="refresh"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ["tiers"] })}
              loading={query.isFetching}
            >
              Refresh
            </Button>
            {canWrite ? (
              <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
                Create grant tier
              </Button>
            ) : null}
          </>
        }
      />
      {notice ? (
        <InlineAlert tone="success" title="Custom tier updated" onDismiss={() => setNotice(null)}>
          {notice}
        </InlineAlert>
      ) : null}
      <Card>
        <div className="card-heading">
          <div>
            <h2>Grant catalogue</h2>
            <p>Published revisions can be assigned to organizations owned by a selected user.</p>
          </div>
          <Badge tone="info" icon="shield">
            No-charge grants
          </Badge>
        </div>
        {query.isLoading ? (
          <QueryLoading label="Loading custom tiers…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length ? (
          <DataTable
            caption="Custom grant tiers"
            rows={rows}
            rowKey={(tier) => tier.id}
            columns={columns}
          />
        ) : (
          <QueryEmpty
            title="No custom tiers"
            description="Create a draft grant definition, validate it, then publish it before assignment."
          />
        )}
      </Card>
      {createOpen ? (
        <TierEditorDialog
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={(requestId) => {
            setCreateOpen(false);
            setNotice(`Request ${requestId} created a draft revision.`);
            void queryClient.invalidateQueries({ queryKey: ["tiers"] });
          }}
        />
      ) : null}
    </>
  );
}

export function CustomTierDetailPage({ id }: { id: string }) {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "tiers.read");
  const canWrite = hasPermission(admin?.permissions ?? [], "tiers.write");
  const query = useAdminQuery(["tier", id], (api) => api.tiers.detail(id), { enabled: canRead });
  const tier = query.data?.data.tier;
  const revisions = query.data?.data.revisions ?? [];
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: TierAction;
    revision?: TierRevision;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const draft = revisions.find((revision) => revision.state === "DRAFT");
  const validated = revisions.find((revision) => revision.state === "VALIDATED");
  const published = revisions.find((revision) => revision.state === "PUBLISHED");
  const currentRevision = revisions[0];
  const limits = revisionLimits(currentRevision);

  const runAction = async (input: { reason?: string; expected_version?: number }) => {
    if (!pendingAction || !tier || input.expected_version === undefined) return;
    const expectedVersion =
      pendingAction.action === "archive" ? tier.version : input.expected_version;
    setActionError(null);
    try {
      const result = await runMutation<{ tier: CustomTierSummary }>({
        path: `/tiers/${encodeURIComponent(tier.id)}:${pendingAction.action}`,
        body: {
          expected_version: expectedVersion,
          ...(input.reason ? { reason: input.reason } : {}),
        },
        step_up_action: `admin:custom_tier_${pendingAction.action}`,
      });
      setPendingAction(null);
      setNotice(`Request ${result.request_id} completed the ${pendingAction.action} action.`);
      await queryClient.invalidateQueries({ queryKey: ["tier", id] });
      await queryClient.invalidateQueries({ queryKey: ["tiers"] });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "The tier action could not be completed.",
      );
    }
  };

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Catalogue / Custom tiers" title="Custom tier" />
        <QueryEmpty
          title="Permission required"
          description="Your role does not include tiers.read."
        />
      </>
    );
  if (query.isLoading)
    return (
      <>
        <PageHeader eyebrow="Catalogue / Custom tiers" title="Custom tier" />
        <QueryLoading label="Loading custom tier…" />
      </>
    );
  if (query.error)
    return (
      <>
        <PageHeader eyebrow="Catalogue / Custom tiers" title="Custom tier" />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  if (!tier)
    return (
      <>
        <PageHeader eyebrow="Catalogue / Custom tiers" title="Custom tier" />
        <QueryEmpty
          title="Custom tier unavailable"
          description="No tier definition was returned for this ID."
        />
      </>
    );

  return (
    <>
      <PageHeader
        eyebrow="Catalogue / Custom tiers"
        title={tier.name}
        description={tier.description ?? "No description provided."}
        actions={
          <>
            <Link href="/tiers" className="button button-quiet">
              Back to custom tiers
            </Link>
            {canWrite && tier.state !== "ARCHIVED" ? (
              <Button variant="secondary" icon="edit" onClick={() => setEditorOpen(true)}>
                Create new revision
              </Button>
            ) : null}
          </>
        }
      />
      {notice ? (
        <InlineAlert tone="success" title="Custom tier updated" onDismiss={() => setNotice(null)}>
          {notice}
        </InlineAlert>
      ) : null}
      {actionError ? (
        <InlineAlert tone="danger" title="Action not completed">
          {actionError}
        </InlineAlert>
      ) : null}
      <div className="detail-grid">
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Grant definition</h2>
                <p>
                  Displayed prices are informational and are never charged or added to invoices.
                </p>
              </div>
              <StatusBadge value={tier.state} />
            </div>
            <div className="detail-section">
              <div className="metric-bar">
                <div className="metric-bar-item">
                  <span>Stable key</span>
                  <strong className="mono">{tier.key}</strong>
                </div>
                <div className="metric-bar-item">
                  <span>Presentation price</span>
                  <strong>{displayedTierPrice(tier)}</strong>
                </div>
                <div className="metric-bar-item">
                  <span>Default duration</span>
                  <strong>
                    {tier.default_duration_days ? `${tier.default_duration_days} days` : "Not set"}
                  </strong>
                </div>
              </div>
              <Badge tone="info">Grant only</Badge>
            </div>
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <h2>Enforced limits</h2>
                <p>Only the limits currently consumed by managed data products are listed here.</p>
              </div>
            </div>
            {limits.length ? (
              <DataTable
                caption="Enforced custom tier limits"
                rows={limits}
                rowKey={(row) => row.key}
                columns={[
                  { key: "key", label: "Limit", render: (row) => humanize(row.key) },
                  { key: "value", label: "Value", align: "right", render: (row) => row.value },
                ]}
              />
            ) : (
              <QueryEmpty
                title="No limits configured"
                description="This revision does not override an enforced numeric limit."
              />
            )}
          </Card>
          <SafeRecordSummary
            record={tier as unknown as AdminRecord}
            exclude={["limits", "features", "enforced_limit_keys", "unenforced_limit_keys"]}
          />
        </div>
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Revision controls</h2>
                <p>Validate and publish immutable definitions before granting them.</p>
              </div>
              <Badge tone="warning" icon="shield">
                Step-up protected
              </Badge>
            </div>
            <div className="detail-section action-row">
              {canWrite && draft ? (
                <Button
                  variant="secondary"
                  onClick={() => setPendingAction({ action: "validate", revision: draft })}
                >
                  Validate draft
                </Button>
              ) : null}
              {canWrite && validated ? (
                <Button
                  variant="primary"
                  onClick={() => setPendingAction({ action: "publish", revision: validated })}
                >
                  Publish revision
                </Button>
              ) : null}
              {canWrite && tier.state !== "ARCHIVED" ? (
                <Button
                  variant="danger-quiet"
                  onClick={() => setPendingAction({ action: "archive" })}
                >
                  Archive tier
                </Button>
              ) : null}
              {!canWrite ? <Badge tone="neutral">Read only</Badge> : null}
            </div>
            {revisions.length ? (
              <DataTable
                caption="Custom tier revision history"
                rows={revisions}
                rowKey={(revision) => revision.id}
                columns={[
                  {
                    key: "revision",
                    label: "Revision",
                    render: (revision) => (
                      <span>
                        Revision {revision.revision} <small className="mono">{revision.id}</small>
                      </span>
                    ),
                  },
                  {
                    key: "state",
                    label: "State",
                    render: (revision) => <StatusBadge value={revision.state} />,
                  },
                  {
                    key: "version",
                    label: "Version",
                    render: (revision) => `v${revision.version}`,
                  },
                  {
                    key: "updated",
                    label: "Updated",
                    render: (revision) => formatDate(revision.updated_at),
                  },
                ]}
              />
            ) : (
              <QueryEmpty
                title="No revisions"
                description="No definition revisions are available."
              />
            )}
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <h2>Grant status</h2>
                <p>Assignments are managed from the selected user detail page.</p>
              </div>
              <Badge tone="neutral">No charge</Badge>
            </div>
            <div className="detail-section">
              <p>
                {published
                  ? `Published revision ${published.revision} is available for assignment.`
                  : "This tier has no published revision yet."}
              </p>
              <Link href="/users" className="button button-quiet">
                Find a customer user
              </Link>
            </div>
          </Card>
        </div>
      </div>
      {editorOpen ? (
        <TierEditorDialog
          mode="edit"
          tier={tier}
          revision={currentRevision}
          onClose={() => setEditorOpen(false)}
          onSaved={(requestId) => {
            setEditorOpen(false);
            setNotice(`Request ${requestId} created a new draft revision.`);
            void queryClient.invalidateQueries({ queryKey: ["tier", id] });
            void queryClient.invalidateQueries({ queryKey: ["tiers"] });
          }}
        />
      ) : null}
      {pendingAction ? (
        <ConfirmActionModal
          title={`${humanize(pendingAction.action)} custom tier`}
          target={`${tier.key}${pendingAction.revision ? ` · revision ${pendingAction.revision.revision}` : ""}`}
          description={
            pendingAction.action === "archive"
              ? "Archiving hides this grant tier from future assignments. Existing history stays available."
              : "The backend checks the immutable revision and its current version before continuing."
          }
          actionLabel={humanize(pendingAction.action)}
          dangerous={pendingAction.action === "archive"}
          expectedVersion={
            pendingAction.action === "archive" ? tier.version : pendingAction.revision?.version
          }
          reasonRequired={false}
          onConfirm={runAction}
          onClose={() => setPendingAction(null)}
        />
      ) : null}
    </>
  );
}

function TierEditorDialog({
  mode,
  tier,
  revision,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  tier?: CustomTierSummary;
  revision?: TierRevision;
  onClose: () => void;
  onSaved: (requestId: string) => void;
}) {
  const { runMutation } = useAdminSession();
  const [key, setKey] = useState(tier?.key ?? "");
  const [name, setName] = useState(revision?.display_name ?? tier?.name ?? "");
  const [description, setDescription] = useState(revision?.description ?? tier?.description ?? "");
  const [billingMode, setBillingMode] = useState<"FREE" | "PAID">(
    revision?.price_kind ?? tier?.billing_mode ?? "FREE",
  );
  const [usd, setUsd] = useState(String(revision?.price_usd_minor ?? tier?.price_usd_minor ?? 0));
  const [inr, setInr] = useState(String(revision?.price_inr_minor ?? tier?.price_inr_minor ?? 0));
  const [duration, setDuration] = useState(
    String(revision?.duration_days ?? tier?.default_duration_days ?? 30),
  );
  const [limitValues, setLimitValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      editableTierLimits.map((limit) => [
        limit,
        revision?.limits[limit] == null ? "" : String(revision.limits[limit]),
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (mode === "create" && !/^[a-z][a-z0-9_]{1,47}$/.test(key.trim())) {
      setError("Use a lowercase stable key with letters, digits, and underscores.");
      return;
    }
    if (!name.trim() || name.trim().length > 100) {
      setError("Add a display name of 1 to 100 characters.");
      return;
    }
    const numericDuration = Number(duration);
    if (!Number.isInteger(numericDuration) || numericDuration < 1 || numericDuration > 365) {
      setError("Duration must be a whole number from 1 to 365 days.");
      return;
    }
    const usdMinor = billingMode === "FREE" ? 0 : Number(usd);
    const inrMinor = billingMode === "FREE" ? 0 : Number(inr);
    if (
      billingMode === "PAID" &&
      ![usdMinor, inrMinor].every((amount) => Number.isSafeInteger(amount) && amount > 0)
    ) {
      setError("Both reference prices must be positive whole-number minor-unit amounts.");
      return;
    }
    const limits: Record<string, number | null> = { ...(revision?.limits ?? {}) };
    for (const limit of editableTierLimits) {
      const raw = limitValues[limit] ?? "";
      if (raw === "") {
        delete limits[limit];
        continue;
      }
      const value = Number(raw);
      if (
        !Number.isSafeInteger(value) ||
        (value < 0 && !(limit === "quick_databases_total" && value === -1))
      ) {
        setError(
          `${humanize(limit)} must be a non-negative whole number${limit === "quick_databases_total" ? " or -1 for unlimited" : ""}.`,
        );
        return;
      }
      limits[limit] = value;
    }
    const body: CustomTierDraftBody = {
      ...(mode === "create" ? { key: key.trim() } : {}),
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      billing_mode: billingMode,
      ...(billingMode === "PAID" ? { price_usd_minor: usdMinor, price_inr_minor: inrMinor } : {}),
      interval: "GRANT",
      default_duration_days: numericDuration,
      limits,
      features: revision
        ? Object.entries(revision.features)
            .filter(([, enabled]) => enabled)
            .map(([feature]) => feature)
        : [],
      ...(mode === "edit" && tier ? { expected_version: tier.version } : {}),
    };
    setSaving(true);
    try {
      const response =
        mode === "create"
          ? await runMutation<{ tier: CustomTierSummary }>({
              path: "/tiers",
              body,
              step_up_action: "admin:custom_tier_create",
            })
          : await runMutation<{ tier: CustomTierSummary }>({
              method: "PATCH",
              path: `/tiers/${encodeURIComponent(tier!.id)}`,
              body,
              step_up_action: "admin:custom_tier_edit",
            });
      onSaved(response.request_id);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The custom tier draft could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={mode === "create" ? "Create grant tier" : "Create tier revision"}
      description="Every assignment is an explicit no-charge grant. These reference prices do not affect billing."
      onClose={saving ? () => undefined : onClose}
      size="large"
    >
      <ModalForm
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {mode === "create" ? "Create draft" : "Create revision draft"}
            </Button>
          </>
        }
      >
        {error ? (
          <InlineAlert tone="danger" title="Draft not saved">
            {error}
          </InlineAlert>
        ) : null}
        <div className="two-col-fields">
          {mode === "create" ? (
            <Field
              label="Stable tier key"
              hint="Lowercase letters, numbers, and underscores; immutable after creation."
            >
              <TextInput
                value={key}
                onChange={(event) => setKey(event.target.value)}
                maxLength={48}
                required
              />
            </Field>
          ) : null}
          <Field label="Display name">
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
          </Field>
        </div>
        <Field label="Description">
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 1000))}
            maxLength={1000}
          />
        </Field>
        <div className="two-col-fields">
          <Field label="Reference price label">
            <SelectInput
              value={billingMode}
              onChange={(event) => setBillingMode(event.target.value as "FREE" | "PAID")}
            >
              <option value="FREE">No-charge reference</option>
              <option value="PAID">Paid-looking reference only</option>
            </SelectInput>
          </Field>
          <Field label="Default grant duration (days)">
            <TextInput
              type="number"
              min="1"
              max="365"
              step="1"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              required
            />
          </Field>
        </div>
        {billingMode === "PAID" ? (
          <div className="two-col-fields">
            <Field
              label="Reference USD cents"
              hint="Shown in the tier catalogue only; never charged."
            >
              <TextInput
                type="number"
                min="1"
                step="1"
                value={usd}
                onChange={(event) => setUsd(event.target.value)}
                required
              />
            </Field>
            <Field
              label="Reference INR paise"
              hint="Shown in the tier catalogue only; never charged."
            >
              <TextInput
                type="number"
                min="1"
                step="1"
                value={inr}
                onChange={(event) => setInr(event.target.value)}
                required
              />
            </Field>
          </div>
        ) : null}
        <section aria-labelledby="tier-limits-title" className="catalogue-editor-section">
          <div className="section-heading">
            <div>
              <h3 id="tier-limits-title">Enforced data limits</h3>
              <p>Leave a limit blank to leave that entitlement unchanged.</p>
            </div>
          </div>
          <div className="limit-grid">
            {editableTierLimits.map((limit) => (
              <Field key={limit} label={humanize(limit)}>
                <TextInput
                  type="number"
                  min={limit === "quick_databases_total" ? "-1" : "0"}
                  step="1"
                  value={limitValues[limit] ?? ""}
                  onChange={(event) =>
                    setLimitValues((current) => ({ ...current, [limit]: event.target.value }))
                  }
                />
              </Field>
            ))}
          </div>
        </section>
      </ModalForm>
    </Modal>
  );
}

export function UserTierAssignments({
  userId,
  organizations,
}: {
  userId: string;
  organizations: AdminRecord[];
}) {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "tiers.read");
  const canAssign = hasPermission(admin?.permissions ?? [], "tiers.assign");
  const owners = organizations.filter((org) => org.role === "OWNER" && org.state !== "DELETED");
  const assignmentsQuery = useAdminQuery(
    ["user-tier-assignments", userId],
    (api) => api.users.tierAssignments(userId),
    { enabled: canRead },
  );
  const [grantOpen, setGrantOpen] = useState(false);
  const [revoke, setRevoke] = useState<TierAssignmentSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const assignments = assignmentsQuery.data?.data.assignments ?? [];
  const columns = useMemo<TableColumn<TierAssignmentSummary>[]>(
    () => [
      {
        key: "tier",
        label: "Grant",
        render: (assignment) => (
          <>
            <strong>{assignment.tier_name ?? assignment.tier_key ?? "Custom tier"}</strong>
            <small className="mono">{assignment.revision_id}</small>
          </>
        ),
      },
      {
        key: "organization",
        label: "Organization",
        render: (assignment) => <span className="mono">{assignment.org_id}</span>,
      },
      {
        key: "status",
        label: "Status",
        render: (assignment) => <StatusBadge value={assignment.status} />,
      },
      {
        key: "expires",
        label: "Expires",
        render: (assignment) => formatDate(assignment.expires_at),
      },
      { key: "reason", label: "Reason", render: (assignment) => assignment.reason },
      {
        key: "actions",
        label: "",
        align: "right",
        render: (assignment) =>
          canAssign && assignment.status === "ACTIVE" ? (
            <Button variant="danger-quiet" onClick={() => setRevoke(assignment)}>
              Revoke
            </Button>
          ) : null,
      },
    ],
    [canAssign],
  );

  const revokeAssignment = async (input: { reason?: string; expected_version?: number }) => {
    if (!revoke || input.expected_version === undefined) return;
    await runMutation({
      path: `/users/${encodeURIComponent(userId)}/tier-assignments/${encodeURIComponent(revoke.id)}:revoke`,
      body: { reason: input.reason ?? "", expected_version: input.expected_version },
      step_up_action: "admin:custom_tier_revoke",
    });
    setRevoke(null);
    await queryClient.invalidateQueries({ queryKey: ["user-tier-assignments", userId] });
    setNotice("The assignment projection was refreshed.");
  };

  if (!canRead) return null;
  return (
    <Card>
      <div className="card-heading">
        <div>
          <h2>Custom tier assignments</h2>
          <p>
            Grants apply to organizations owned by this user. They are no charge and never change
            subscriptions or invoices.
          </p>
        </div>
        {canAssign ? (
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setGrantOpen(true)}
            disabled={!owners.length}
          >
            Grant tier
          </Button>
        ) : (
          <Badge tone="neutral">Read only</Badge>
        )}
      </div>
      {notice ? (
        <InlineAlert tone="success" title="Assignment updated" onDismiss={() => setNotice(null)}>
          {notice}
        </InlineAlert>
      ) : null}
      {!owners.length ? (
        <p className="security-note">
          This user has no active organization that they own, so an organization-bound grant cannot
          be assigned.
        </p>
      ) : null}
      {assignmentsQuery.isLoading ? (
        <QueryLoading label="Loading tier assignments…" />
      ) : assignmentsQuery.error ? (
        <QueryError
          error={assignmentsQuery.error}
          onRetry={() => void assignmentsQuery.refetch()}
        />
      ) : assignments.length ? (
        <DataTable
          caption="Custom tier assignments"
          rows={assignments}
          rowKey={(assignment) => assignment.id}
          columns={columns}
        />
      ) : (
        <QueryEmpty
          title="No custom tier assignments"
          description="No grant history was returned for organizations owned by this user."
        />
      )}
      {grantOpen ? (
        <AssignTierDialog
          userId={userId}
          ownerOrganizations={owners}
          assignments={assignments}
          onClose={() => setGrantOpen(false)}
          onAssigned={(requestId) => {
            setGrantOpen(false);
            setNotice(`Request ${requestId} created a no-charge grant.`);
            void queryClient.invalidateQueries({ queryKey: ["user-tier-assignments", userId] });
            void queryClient.invalidateQueries({ queryKey: ["user", userId] });
          }}
        />
      ) : null}
      {revoke ? (
        <ConfirmActionModal
          title="Revoke custom tier assignment"
          target={`${revoke.tier_name ?? revoke.tier_key ?? revoke.tier_id} · ${revoke.org_id}`}
          description="This closes the active no-charge grant and rebuilds the organization's effective entitlement projection."
          actionLabel="Revoke grant"
          dangerous
          expectedVersion={revoke.version}
          onConfirm={revokeAssignment}
          onClose={() => setRevoke(null)}
        />
      ) : null}
    </Card>
  );
}

function AssignTierDialog({
  userId,
  ownerOrganizations,
  assignments,
  onClose,
  onAssigned,
}: {
  userId: string;
  ownerOrganizations: AdminRecord[];
  assignments: TierAssignmentSummary[];
  onClose: () => void;
  onAssigned: (requestId: string) => void;
}) {
  const { runMutation } = useAdminSession();
  const tiersQuery = useAdminQuery(["tiers"], (api) => api.tiers.list());
  const [orgId, setOrgId] = useState(String(ownerOrganizations[0]?.id ?? ""));
  const [tierId, setTierId] = useState("");
  const [duration, setDuration] = useState("30");
  const [reason, setReason] = useState("");
  const [replaceActive, setReplaceActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const tiers = (tiersQuery.data?.data.tiers ?? []).filter(
    (tier) => tier.system !== true && tier.state !== "ARCHIVED",
  );
  const selectedTier = tiers.find((tier) => tier.id === tierId);
  const detailQuery = useAdminQuery(["tier", tierId], (api) => api.tiers.detail(tierId), {
    enabled: Boolean(tierId),
  });
  const published = detailQuery.data?.data.revisions?.find(
    (revision) => revision.state === "PUBLISHED",
  );
  const activeAssignment = assignments.find(
    (assignment) => assignment.org_id === orgId && assignment.status === "ACTIVE",
  );

  const submit = async () => {
    setError(null);
    const days = Number(duration);
    if (!selectedTier || !published) {
      setError("Choose a custom tier with a published revision.");
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setError("Duration must be a whole number from 1 to 365 days.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Add a reason with at least 3 characters.");
      return;
    }
    if (activeAssignment && !replaceActive) {
      setError(
        "This organization already has an active grant. Confirm replacement or choose another organization.",
      );
      return;
    }
    setSaving(true);
    try {
      const response = await runMutation<{ assignment: TierAssignmentSummary }>({
        path: `/users/${encodeURIComponent(userId)}/tier-assignments`,
        body: {
          org_id: orgId,
          tier_id: selectedTier.id,
          revision_id: published.id,
          duration_days: days,
          expected_version: activeAssignment?.version ?? 0,
          replace_active: replaceActive,
          reason: reason.trim(),
        },
        step_up_action: "admin:custom_tier_assign",
      });
      onAssigned(response.request_id);
    } catch (assignmentError) {
      setError(
        assignmentError instanceof Error
          ? assignmentError.message
          : "The tier grant could not be assigned.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Grant a custom tier"
      description="This adds a time-bound, no-charge grant to an organization owned by this user."
      onClose={saving ? () => undefined : onClose}
      size="medium"
    >
      <ModalForm
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Assign grant
            </Button>
          </>
        }
      >
        {error ? (
          <InlineAlert tone="danger" title="Grant not assigned">
            {error}
          </InlineAlert>
        ) : null}
        {tiersQuery.error ? (
          <QueryError error={tiersQuery.error} onRetry={() => void tiersQuery.refetch()} />
        ) : null}
        <Field label="Owned organization">
          <SelectInput
            value={orgId}
            onChange={(event) => {
              setOrgId(event.target.value);
              setReplaceActive(false);
            }}
            required
          >
            {ownerOrganizations.map((org) => (
              <option key={String(org.id)} value={String(org.id)}>
                {String(org.name ?? org.slug ?? org.id)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Custom tier">
          <SelectInput value={tierId} onChange={(event) => setTierId(event.target.value)} required>
            <option value="">Choose a tier</option>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name} · {tier.key}
              </option>
            ))}
          </SelectInput>
        </Field>
        {detailQuery.isLoading ? (
          <QueryLoading label="Checking published revision…" />
        ) : detailQuery.error ? (
          <QueryError error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
        ) : selectedTier && !published ? (
          <InlineAlert tone="warning" title="Tier is not ready">
            Publish a tier revision before assigning it.
          </InlineAlert>
        ) : published ? (
          <p className="field-hint">
            Pinned to published revision {published.revision}. Default duration is{" "}
            {published.duration_days} days.
          </p>
        ) : null}
        <div className="two-col-fields">
          <Field label="Grant duration (days)">
            <TextInput
              type="number"
              min="1"
              max="365"
              step="1"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              required
            />
          </Field>
          <Field label="Reason">
            <TextArea
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 500))}
              minLength={3}
              maxLength={500}
              required
            />
          </Field>
        </div>
        {activeAssignment ? (
          <label className="check-field">
            <input
              type="checkbox"
              checked={replaceActive}
              onChange={(event) => setReplaceActive(event.target.checked)}
            />
            <span>
              Replace the active grant ({activeAssignment.tier_name ?? activeAssignment.tier_key})
            </span>
          </label>
        ) : null}
        <p className="security-note">
          This grant does not change billing status, checkout prices, subscription items, or
          invoices.
        </p>
      </ModalForm>
    </Modal>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate, formatMoneyMinor } from "@/lib/admin/format";
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
  InlineAlert,
  PageHeader,
  SelectInput,
  StatusBadge,
  TableColumn,
  TextArea,
  TextInput,
} from "@/components/ui";
import type { AdminListQuery, AdminRecord } from "@/lib/admin/types";

export type BillingKind = "subscriptions" | "invoices" | "payments" | "refunds";

const configs: Record<
  BillingKind,
  { title: string; description: string; dataKey: string; href: string }
> = {
  subscriptions: {
    title: "Subscriptions",
    description: "Plan lifecycle, periods, and safe item snapshots.",
    dataKey: "subscriptions",
    href: "/billing/subscriptions",
  },
  invoices: {
    title: "Invoices",
    description: "Immutable invoice and sanitized line snapshots.",
    dataKey: "invoices",
    href: "/billing/invoices",
  },
  payments: {
    title: "Payments",
    description: "Payment attempts and bounded failure evidence.",
    dataKey: "payments",
    href: "/billing/payments",
  },
  refunds: {
    title: "Refunds",
    description: "Refund and GST credit-note state without gateway references.",
    dataKey: "refunds",
    href: "/billing/refunds",
  },
};

async function listFor(
  api: ReturnType<typeof useAdminSession>["api"],
  kind: BillingKind,
  query: AdminListQuery,
): Promise<ApiResult<AdminRecord>> {
  const result =
    kind === "subscriptions"
      ? await api.billing.subscriptions(query)
      : kind === "invoices"
        ? await api.billing.invoices(query)
        : kind === "payments"
          ? await api.billing.payments(query)
          : await api.billing.refunds(query);
  return { data: result.data as AdminRecord, request_id: result.request_id };
}

function primaryValue(row: AdminRecord, kind: BillingKind): string {
  if (kind === "subscriptions")
    return typeof row.plan_code === "string" ? row.plan_code : String(row.id ?? "Subscription");
  if (kind === "invoices")
    return typeof row.invoice_number === "string"
      ? row.invoice_number
      : String(row.id ?? "Invoice");
  if (kind === "payments")
    return typeof row.payment_id === "string" ? row.payment_id : String(row.id ?? "Payment");
  return typeof row.refund_id === "string" ? row.refund_id : String(row.id ?? "Refund");
}

function moneyValue(row: AdminRecord): React.ReactNode {
  const amount = row.amount_minor ?? row.total_minor ?? row.refunded_amount_minor;
  const currency = row.currency;
  return typeof amount === "number" && typeof currency === "string"
    ? formatMoneyMinor(amount, currency)
    : "—";
}

export function BillingListPage({ kind }: { kind: BillingKind }) {
  const config = configs[kind];
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.roles ?? [], "billing.read");
  const [draft, setDraft] = useState({ org_id: "", status: "", currency: "" });
  const [filters, setFilters] = useState(draft);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const query = useAdminQuery(
    ["billing", kind, filters, cursor],
    (api) => listFor(api, kind, { ...filters, cursor, limit: 25 }),
    { enabled: canRead },
  );
  const rows = query.data?.data
    ? (((query.data.data as AdminRecord)[config.dataKey] as unknown[] | undefined)?.filter(
        (row): row is AdminRecord => Boolean(row && typeof row === "object"),
      ) ?? [])
    : [];
  const nextCursor =
    typeof (query.data?.data as AdminRecord | undefined)?.next_cursor === "string"
      ? String((query.data?.data as AdminRecord).next_cursor)
      : null;
  const columns = useMemo<TableColumn<AdminRecord>[]>(
    () => [
      {
        key: "primary",
        label: config.title.slice(0, -1),
        render: (row) => (
          <Link
            href={`${config.href}/${String(row.id ?? row.subscription_id ?? row.invoice_id ?? row.payment_id ?? row.refund_id ?? "unknown")}`}
            className="primary-cell"
          >
            <span className="row-avatar">
              {kind === "subscriptions"
                ? "S"
                : kind === "invoices"
                  ? "I"
                  : kind === "payments"
                    ? "P"
                    : "R"}
            </span>
            <span className="primary-cell-copy">
              <strong>{primaryValue(row, kind)}</strong>
              <small>{typeof row.org_id === "string" ? row.org_id : String(row.id ?? "")}</small>
            </span>
          </Link>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => <StatusBadge value={row.status ?? row.state ?? "UNKNOWN"} />,
      },
      { key: "amount", label: "Amount", align: "right", render: (row) => moneyValue(row) },
      {
        key: "currency",
        label: "Currency",
        render: (row) => (typeof row.currency === "string" ? row.currency.toUpperCase() : "—"),
      },
      {
        key: "updated",
        label: "Recorded",
        render: (row) => formatDate(row.updated_at ?? row.created_at ?? row.issued_at),
      },
    ],
    [config.href, config.title, kind],
  );
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({ ...draft });
    setCursorStack([undefined]);
  };
  const clear = () => {
    const empty = { org_id: "", status: "", currency: "" };
    setDraft(empty);
    setFilters(empty);
    setCursorStack([undefined]);
  };
  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Billing"
          title={config.title}
          description="Billing access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask for billing.read to inspect money and subscription projections."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title={config.title}
        description={config.description}
        actions={
          <>
            <Button
              variant="secondary"
              icon="refresh"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ["billing", kind] })}
              loading={query.isFetching}
            >
              Refresh
            </Button>
            {kind !== "refunds" ? (
              <div className="billing-tabs">
                <Link
                  href="/billing/subscriptions"
                  className={kind === "subscriptions" ? "is-active" : ""}
                >
                  Subscriptions
                </Link>
                <Link href="/billing/invoices" className={kind === "invoices" ? "is-active" : ""}>
                  Invoices
                </Link>
                <Link href="/billing/payments" className={kind === "payments" ? "is-active" : ""}>
                  Payments
                </Link>
                <Link href="/billing/refunds">Refunds</Link>
              </div>
            ) : null}
          </>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>{config.title} directory</h2>
            <p>Integer minor-unit money · sanitized gateway boundary · no raw payment payloads</p>
          </div>
          <Badge tone="warning" icon="credit-card">
            Money aware
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
          <Field label="Status">
            <TextInput
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({ ...current, status: event.target.value }))
              }
              placeholder="e.g. FAILED"
            />
          </Field>
          <Field label="Currency">
            <SelectInput
              value={draft.currency}
              onChange={(event) =>
                setDraft((current) => ({ ...current, currency: event.target.value }))
              }
            >
              <option value="">All currencies</option>
              <option value="inr">INR</option>
              <option value="usd">USD</option>
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

export function BillingDetailPage({ kind, id }: { kind: BillingKind; id: string }) {
  const config = configs[kind];
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.roles ?? [], "billing.read");
  const canWrite = hasPermission(admin?.roles ?? [], "billing.write");
  const query = useAdminQuery(
    ["billing", kind, id],
    (api) =>
      kind === "subscriptions"
        ? api.billing.subscription(id)
        : kind === "invoices"
          ? api.billing.invoice(id)
          : kind === "payments"
            ? api.billing.payment(id)
            : api.billing.refundDetail(id),
    { enabled: canRead },
  );
  const [pendingAction, setPendingAction] = useState<"cancel" | "refund" | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const record = query.data?.data;
  const main = record?.subscription ?? record?.invoice ?? record?.payment ?? record?.refund;
  const entity = main && typeof main === "object" ? (main as AdminRecord) : record;
  const title =
    entity && typeof entity.invoice_number === "string"
      ? entity.invoice_number
      : entity && typeof entity.plan_code === "string"
        ? entity.plan_code
        : id;
  const entityVersion =
    entity && typeof entity.version === "number" && entity.version >= 1
      ? entity.version
      : undefined;

  const cancel = async (input: { reason?: string; expected_version?: number }) => {
    if (!entity) return;
    if (input.expected_version === undefined) {
      throw new Error("The current subscription version is unavailable. Refresh before retrying.");
    }
    const response = await runMutation<AdminRecord>({
      path: `/billing/subscriptions/${encodeURIComponent(id)}:cancel`,
      body: {
        expected_version: input.expected_version,
        reason: input.reason ?? "",
      },
      step_up_action: "admin:subscription_cancel",
    });
    setRequestId(response.request_id);
    setPendingAction(null);
    await queryClient.invalidateQueries({ queryKey: ["billing", kind, id] });
  };
  const refund = async (input: { reason?: string; amount_minor?: number }) => {
    const response = await runMutation<AdminRecord>({
      path: `/billing/payments/${encodeURIComponent(id)}:refund`,
      body: {
        ...(input.amount_minor ? { amount_minor: input.amount_minor } : {}),
        reason: input.reason ?? "",
      },
      step_up_action: "admin:billing_refund",
    });
    setRequestId(response.request_id);
    setPendingAction(null);
    await queryClient.invalidateQueries({ queryKey: ["billing", "payments", id] });
    await queryClient.invalidateQueries({ queryKey: ["billing", "refunds"] });
  };

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Billing" title={config.title} />
        <QueryEmpty
          title="Permission required"
          description="Ask for billing.read to inspect this record."
        />
      </>
    );
  if (query.isLoading)
    return (
      <>
        <PageHeader eyebrow="Billing" title={config.title} />
        <QueryLoading label={`Loading ${kind} detail…`} />
      </>
    );
  if (query.error)
    return (
      <>
        <PageHeader eyebrow="Billing" title={config.title} />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  if (!record)
    return (
      <>
        <PageHeader eyebrow="Billing" title={config.title} />
        <QueryEmpty
          title="Record unavailable"
          description="The record is absent or outside your current role scope."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow={`Billing / ${config.title}`}
        title={title}
        description="Sanitized billing projection with integer minor-unit amounts and durable audit references."
        actions={
          <Link href={config.href} className="button button-quiet">
            <span>Back to {config.title.toLowerCase()}</span>
          </Link>
        }
      />
      {requestId ? (
        <Card className="result-card">
          <div className="card-heading">
            <div>
              <h2>Billing action accepted</h2>
              <p>
                Review the resulting payment, refund, or subscription projection after it converges.
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
                <h2>Safe billing record</h2>
                <p>Gateway references and raw payloads are deliberately absent.</p>
              </div>
              <StatusBadge value={entity?.status ?? entity?.state ?? "UNKNOWN"} />
            </div>
            <div className="detail-section">
              {entity ? (
                <RecordFacts
                  record={entity}
                  fields={[
                    { key: "id", label: "Record ID", kind: "id" },
                    { key: "org_id", label: "Organization", kind: "id" },
                    { key: "status", label: "Status", kind: "status" },
                    { key: "plan_code", label: "Plan" },
                    { key: "amount_minor", label: "Amount (minor units)" },
                    { key: "currency", label: "Currency" },
                    { key: "version", label: "Version" },
                    { key: "created_at", label: "Created", kind: "date" },
                    { key: "updated_at", label: "Updated", kind: "date" },
                  ]}
                />
              ) : null}
            </div>
          </Card>
          <SafeRecordSummary
            record={record}
            exclude={["subscription", "invoice", "payment", "refund"]}
          />
        </div>
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Actions</h2>
                <p>
                  Every mutation requires explicit reason, stable idempotency, and fresh MFA when
                  enforced.
                </p>
              </div>
              <Badge tone="warning" icon="shield">
                Protected
              </Badge>
            </div>
            <div className="detail-section">
              <div className="action-row">
                {kind === "subscriptions" && canWrite && entityVersion !== undefined ? (
                  <Button
                    variant="danger-quiet"
                    icon="pause"
                    onClick={() => setPendingAction("cancel")}
                  >
                    Cancel subscription
                  </Button>
                ) : kind === "subscriptions" && canWrite ? (
                  <Badge tone="warning">Waiting for current version</Badge>
                ) : null}
                {kind === "payments" && canWrite ? (
                  <Button
                    variant="danger"
                    icon="arrow-up-right"
                    onClick={() => setPendingAction("refund")}
                  >
                    Issue refund
                  </Button>
                ) : null}
                {kind === "payments" && canWrite ? (
                  <Button
                    variant="secondary"
                    icon="refresh"
                    onClick={() =>
                      void runMutation({
                        path: "/billing/reconcile",
                        body: {},
                        step_up_action: "admin:billing_reconcile",
                      }).then((result) => setRequestId(result.request_id))
                    }
                  >
                    Reconcile billing
                  </Button>
                ) : null}
                {!canWrite ? <Badge tone="neutral">Read only</Badge> : null}
              </div>
              <p className="security-note" style={{ marginTop: 14 }}>
                The control panel never calls PayU. It waits for the sanitized local billing
                projection and keeps request/audit evidence visible.
              </p>
            </div>
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <h2>PII boundary</h2>
                <p>Visible fields follow the admin projection.</p>
              </div>
              <Badge tone="success" icon="lock">
                Sanitized
              </Badge>
            </div>
            <div className="detail-section">
              <ul className="plain-list">
                <li>Integer minor-unit money with currency</li>
                <li>Failure state and dates where exposed</li>
                <li>No gateway reference or raw payment payload</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
      {pendingAction === "cancel" && entity ? (
        <ConfirmActionModal
          title="Cancel subscription"
          target={title}
          description="Cancellation follows the billing lifecycle invariants and may queue a durable operation."
          actionLabel="Cancel subscription"
          dangerous
          moneyMoving
          expectedVersion={entityVersion}
          onConfirm={cancel}
          onClose={() => setPendingAction(null)}
        />
      ) : null}
      {pendingAction === "refund" ? (
        <RefundModal onConfirm={refund} onClose={() => setPendingAction(null)} />
      ) : null}
    </>
  );
}

function RefundModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (input: { reason?: string; amount_minor?: number }) => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (reason.trim().length < 3) {
      setError("Add a reason with at least 3 characters.");
      return;
    }
    if (
      amount &&
      (!/^\d+$/.test(amount) || !Number.isSafeInteger(Number(amount)) || Number(amount) < 1)
    ) {
      setError("Enter a positive whole-number amount in minor units, or leave it blank.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm({
        ...(amount ? { amount_minor: Number(amount) } : {}),
        reason: reason.trim(),
      });
    } catch (refundError) {
      setError(
        refundError instanceof Error ? refundError.message : "The refund could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card className="modal-card-inline">
      <div className="card-heading">
        <div>
          <h2>Issue refund</h2>
          <p>Money-moving action · a fresh MFA proof may be requested.</p>
        </div>
        <Badge tone="danger">Money-moving</Badge>
      </div>
      <div className="detail-section">
        <div className="danger-callout">
          <span>!</span>
          <div>
            <strong>Review amount and reason carefully.</strong>
            <span>
              Refunds follow billing invariants and wait for the sanitized refund projection.
            </span>
          </div>
        </div>
        {error ? (
          <InlineAlert tone="danger" title="Refund not completed">
            {error}
          </InlineAlert>
        ) : null}
        <div className="two-col-fields">
          <Field
            label="Amount in minor units"
            hint="Leave blank for the supported full or remaining refund behavior."
          >
            <TextInput
              type="number"
              min="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
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
        <div className="action-row" style={{ marginTop: 14 }}>
          <Button variant="quiet" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void submit()} loading={loading}>
            Confirm refund
          </Button>
        </div>
      </div>
    </Card>
  );
}

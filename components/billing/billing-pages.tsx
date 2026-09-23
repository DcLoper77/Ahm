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

interface BillingFilters {
  org_id: string;
  status: string;
  currency: string;
  plan_code: string;
  invoice_id: string;
  payment_id: string;
}

function billingQuery(
  kind: BillingKind,
  filters: BillingFilters,
  cursor: string | undefined,
): AdminListQuery {
  const shared = { cursor, limit: 25, org_id: filters.org_id, status: filters.status };
  if (kind === "subscriptions")
    return { ...shared, currency: filters.currency, plan_code: filters.plan_code };
  if (kind === "invoices") return { ...shared, currency: filters.currency };
  if (kind === "payments") return { ...shared, invoice_id: filters.invoice_id };
  return { ...shared, payment_id: filters.payment_id };
}

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
    description: "Read-only correction and GST credit-note history without gateway references.",
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
    return typeof row.number === "string" ? row.number : String(row.id ?? "Invoice");
  if (kind === "payments")
    return typeof row.payment_id === "string" ? row.payment_id : String(row.id ?? "Payment");
  return typeof row.refund_id === "string" ? row.refund_id : String(row.id ?? "Refund");
}

function moneyValue(row: AdminRecord): React.ReactNode {
  const amount = row.amount_minor ?? row.total_minor;
  const currency = row.currency;
  return typeof amount === "number" && typeof currency === "string"
    ? formatMoneyMinor(amount, currency)
    : "—";
}

export function BillingListPage({
  kind,
  initialOrgId = "",
}: {
  kind: BillingKind;
  initialOrgId?: string;
}) {
  const config = configs[kind];
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "billing.read");
  const emptyFilters: BillingFilters = {
    org_id: "",
    status: "",
    currency: "",
    plan_code: "",
    invoice_id: "",
    payment_id: "",
  };
  const initialFilters: BillingFilters = { ...emptyFilters, org_id: initialOrgId };
  const [draft, setDraft] = useState<BillingFilters>(initialFilters);
  const [filters, setFilters] = useState<BillingFilters>(initialFilters);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const query = useAdminQuery(
    ["billing", kind, filters, cursor],
    (api) => listFor(api, kind, billingQuery(kind, filters, cursor)),
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
    const empty = {
      org_id: "",
      status: "",
      currency: "",
      plan_code: "",
      invoice_id: "",
      payment_id: "",
    };
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
          {kind === "subscriptions" ? (
            <Field label="Plan">
              <SelectInput
                value={draft.plan_code}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, plan_code: event.target.value }))
                }
              >
                <option value="">All plans</option>
                <option value="free">Free</option>
                <option value="developer">Developer</option>
                <option value="founder">Founder</option>
              </SelectInput>
            </Field>
          ) : null}
          {kind === "subscriptions" || kind === "invoices" ? (
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
          ) : null}
          {kind === "payments" ? (
            <Field label="Invoice ID">
              <TextInput
                value={draft.invoice_id}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, invoice_id: event.target.value }))
                }
                placeholder="Optional inv_…"
              />
            </Field>
          ) : null}
          {kind === "refunds" ? (
            <Field label="Payment ID">
              <TextInput
                value={draft.payment_id}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, payment_id: event.target.value }))
                }
                placeholder="Optional pay_…"
              />
            </Field>
          ) : null}
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
  const canRead = hasPermission(admin?.permissions ?? [], "billing.read");
  const canWrite = hasPermission(admin?.permissions ?? [], "billing.write");
  const canCorrect = hasPermission(admin?.permissions ?? [], "billing.correction");
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
  const [pendingAction, setPendingAction] = useState<"cancel" | "correction" | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const record = query.data?.data;
  const main = record?.subscription ?? record?.invoice ?? record?.payment ?? record?.refund;
  const entity = main && typeof main === "object" ? (main as AdminRecord) : record;
  const title =
    entity && typeof entity.number === "string"
      ? entity.number
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
      step_up_action: "admin:billing_subscription_cancel",
    });
    setRequestId(response.request_id);
    setPendingAction(null);
    await queryClient.invalidateQueries({ queryKey: ["billing", kind, id] });
  };
  const correctPayment = async (input: {
    correction_class:
      "DUPLICATE_CAPTURE" | "PROVIDER_CORRECTION" | "LEGAL_CORRECTION" | "CHARGEBACK_REVERSAL";
    reason: string;
    amount_minor?: number;
  }) => {
    const response = await runMutation<AdminRecord>({
      path: `/billing/payments/${encodeURIComponent(id)}:correct`,
      body: input,
      step_up_action: "admin:billing_correction",
      money_moving: true,
    });
    setRequestId(response.request_id);
    setPendingAction(null);
    await queryClient.invalidateQueries({ queryKey: ["billing", "payments", id] });
    await queryClient.invalidateQueries({ queryKey: ["billing", "payments"] });
    await queryClient.invalidateQueries({ queryKey: ["billing", "refunds"] });
  };

  const reconcileBilling = async () => {
    setActionError(null);
    try {
      const response = await runMutation<AdminRecord>({
        path: "/billing/reconcile",
        body: {},
        step_up_action: "admin:billing_reconcile",
      });
      setRequestId(response.request_id);
      await queryClient.invalidateQueries({ queryKey: ["billing"] });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Billing reconciliation could not be queued.",
      );
    }
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
      {actionError ? (
        <InlineAlert tone="danger" title="Action not completed">
          {actionError}
        </InlineAlert>
      ) : null}
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
                {kind === "refunds" ? <Badge tone="neutral">Read-only refund history</Badge> : null}
                {kind === "subscriptions" &&
                canWrite &&
                entityVersion !== undefined &&
                entity?.cancel_at_period_end !== true ? (
                  <Button
                    variant="danger-quiet"
                    icon="pause"
                    onClick={() => setPendingAction("cancel")}
                  >
                    Cancel subscription
                  </Button>
                ) : kind === "subscriptions" &&
                  canWrite &&
                  entity?.cancel_at_period_end !== true ? (
                  <Badge tone="warning">Waiting for current version</Badge>
                ) : null}
                {kind === "subscriptions" && entity?.cancel_at_period_end === true ? (
                  <Badge tone="info">Cancellation already scheduled for period end</Badge>
                ) : null}
                {kind === "payments" && canCorrect ? (
                  <Button
                    variant="secondary"
                    icon="arrow-up-right"
                    onClick={() => {
                      setActionError(null);
                      setPendingAction("correction");
                    }}
                  >
                    Correct payment
                  </Button>
                ) : null}
                {kind === "payments" && !canCorrect ? (
                  <Badge tone="neutral">Payment correction permission required</Badge>
                ) : null}
                {kind === "payments" && canWrite ? (
                  <Button
                    variant="secondary"
                    icon="refresh"
                    onClick={() => void reconcileBilling()}
                  >
                    Reconcile billing
                  </Button>
                ) : null}
                {!canWrite && !canCorrect && kind !== "refunds" ? (
                  <Badge tone="neutral">Read only</Badge>
                ) : null}
              </div>
              <p className="security-note" style={{ marginTop: 14 }}>
                Payment corrections use the classified billing action and require
                billing.correction, a reason, idempotency, and fresh step-up. Refund records remain
                read-only history.
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
          description="This schedules cancellation at the current period end. Immediate cancellation is not available."
          actionLabel="Cancel subscription"
          dangerous
          expectedVersion={entityVersion}
          onConfirm={cancel}
          onClose={() => setPendingAction(null)}
        />
      ) : null}
      {pendingAction === "correction" ? (
        <PaymentCorrectionModal onConfirm={correctPayment} onClose={() => setPendingAction(null)} />
      ) : null}
    </>
  );
}

function PaymentCorrectionModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (input: {
    correction_class:
      "DUPLICATE_CAPTURE" | "PROVIDER_CORRECTION" | "LEGAL_CORRECTION" | "CHARGEBACK_REVERSAL";
    reason: string;
    amount_minor?: number;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [correctionClass, setCorrectionClass] = useState<
    "DUPLICATE_CAPTURE" | "PROVIDER_CORRECTION" | "LEGAL_CORRECTION" | "CHARGEBACK_REVERSAL"
  >("DUPLICATE_CAPTURE");
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
      setError("Enter a positive whole-number amount in minor units, or leave the amount blank.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm({
        correction_class: correctionClass,
        ...(amount ? { amount_minor: Number(amount) } : {}),
        reason: reason.trim(),
      });
    } catch (correctionError) {
      setError(
        correctionError instanceof Error
          ? correctionError.message
          : "The payment correction could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card className="modal-card-inline">
      <div className="card-heading">
        <div>
          <h2>Correct payment</h2>
          <p>Money-moving action · a fresh MFA proof may be requested.</p>
        </div>
        <Badge tone="danger">Money-moving</Badge>
      </div>
      <div className="detail-section">
        <div className="danger-callout">
          <span>!</span>
          <div>
            <strong>Choose the supported correction class.</strong>
            <span>
              This records a classified billing correction and waits for the sanitized correction
              projection.
            </span>
          </div>
        </div>
        {error ? (
          <InlineAlert tone="danger" title="Correction not completed">
            {error}
          </InlineAlert>
        ) : null}
        <div className="two-col-fields">
          <Field label="Correction class">
            <SelectInput
              value={correctionClass}
              onChange={(event) => setCorrectionClass(event.target.value as typeof correctionClass)}
            >
              <option value="DUPLICATE_CAPTURE">Duplicate capture</option>
              <option value="PROVIDER_CORRECTION">Provider correction</option>
              <option value="LEGAL_CORRECTION">Legal correction</option>
              <option value="CHARGEBACK_REVERSAL">Chargeback reversal</option>
            </SelectInput>
          </Field>
          <Field
            label="Amount in minor units"
            hint="Optional. Use only the amount covered by the classified correction."
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
            Submit correction
          </Button>
        </div>
      </div>
    </Card>
  );
}

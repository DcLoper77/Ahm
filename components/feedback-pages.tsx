"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { useAdminSession } from "@/components/auth/session-context";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import type { CustomerFeedbackSummary } from "@/lib/admin/types";
import type { AdminListQuery } from "@/lib/admin/types";
import {
  Badge,
  Button,
  Card,
  CursorPagination,
  DataTable,
  Field,
  PageHeader,
  TableColumn,
  TextInput,
  SelectInput,
} from "@/components/ui";

type FeedbackFilters = {
  stars: string;
  user_id: string;
  from: string;
  to: string;
  sort_by: "created_at" | "stars";
  sort_order: "asc" | "desc";
};

const emptyFilters: FeedbackFilters = {
  stars: "",
  user_id: "",
  from: "",
  to: "",
  sort_by: "created_at",
  sort_order: "desc",
};

function dayBoundary(value: string, end: boolean): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`).toISOString();
}

function toQuery(filters: FeedbackFilters, cursor: string | undefined): AdminListQuery {
  return {
    cursor,
    limit: 25,
    stars: filters.stars ? Number(filters.stars) : undefined,
    user_id: filters.user_id.trim() || undefined,
    from: dayBoundary(filters.from, false),
    to: dayBoundary(filters.to, true),
    sort_by: filters.sort_by,
    sort_order: filters.sort_order,
  };
}

export function StarRating({ stars }: { stars: number }) {
  const safeStars = Math.min(5, Math.max(0, Math.trunc(stars)));
  return (
    <span className="feedback-stars" aria-label={`${safeStars} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} aria-hidden="true" className={index < safeStars ? "is-filled" : ""}>
          ★
        </span>
      ))}
    </span>
  );
}

function messagePreview(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}…` : normalized;
}

export function FeedbackListPage() {
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.roles ?? [], "analytics.read");
  const [draft, setDraft] = useState<FeedbackFilters>(emptyFilters);
  const [filters, setFilters] = useState<FeedbackFilters>(emptyFilters);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const query = useAdminQuery(
    ["feedback", filters, cursor],
    (api) => api.feedback.list(toQuery(filters, cursor)),
    { enabled: canRead },
  );
  const rows = query.data?.data.feedback ?? [];
  const nextCursor = query.data?.data.next_cursor ?? null;

  const columns = useMemo<TableColumn<CustomerFeedbackSummary>[]>(
    () => [
      {
        key: "feedback",
        label: "Feedback",
        render: (row) => (
          <Link href={`/feedback/${row.id}`} className="primary-cell">
            <span className="row-avatar">★</span>
            <span className="primary-cell-copy">
              <strong>{messagePreview(row.message) || "Empty message"}</strong>
              <small>{row.id}</small>
            </span>
          </Link>
        ),
      },
      {
        key: "stars",
        label: "Rating",
        render: (row) => <StarRating stars={row.stars} />,
      },
      {
        key: "user",
        label: "Customer",
        render: (row) => <code>{row.user_id}</code>,
      },
      {
        key: "submitted",
        label: "Submitted",
        render: (row) => formatDate(row.created_at),
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
    setDraft(emptyFilters);
    setFilters(emptyFilters);
    setCursorStack([undefined]);
  };

  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Command center"
          title="Customer feedback"
          description="Feedback access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask for analytics.read to inspect customer-submitted ratings and messages."
        />
      </>
    );

  return (
    <>
      <PageHeader
        eyebrow="Command center"
        title="Customer feedback"
        description="Read-only customer ratings and messages received through the main website."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["feedback"] })}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Feedback inbox</h2>
            <p>
              Customer submissions are immutable here; this surface never creates or edits feedback.
            </p>
          </div>
          <Badge tone="info" icon="star">
            Read only
          </Badge>
        </div>
        <form className="filter-bar" onSubmit={apply}>
          <Field label="Stars">
            <SelectInput
              value={draft.stars}
              onChange={(event) =>
                setDraft((current) => ({ ...current, stars: event.target.value }))
              }
            >
              <option value="">All ratings</option>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} stars
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Customer ID">
            <TextInput
              value={draft.user_id}
              onChange={(event) =>
                setDraft((current) => ({ ...current, user_id: event.target.value }))
              }
              placeholder="Optional usr_…"
            />
          </Field>
          <Field label="From">
            <TextInput
              type="date"
              value={draft.from}
              onChange={(event) =>
                setDraft((current) => ({ ...current, from: event.target.value }))
              }
            />
          </Field>
          <Field label="To">
            <TextInput
              type="date"
              value={draft.to}
              onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            />
          </Field>
          <Field label="Sort">
            <SelectInput
              value={draft.sort_by}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sort_by: event.target.value as FeedbackFilters["sort_by"],
                }))
              }
            >
              <option value="created_at">Submitted</option>
              <option value="stars">Stars</option>
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
          <QueryLoading label="Loading customer feedback…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length ? (
          <>
            <DataTable
              caption="Customer feedback"
              rows={rows}
              rowKey={(row) => row.id}
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
                label="feedback submissions"
              />
            </div>
          </>
        ) : (
          <QueryEmpty
            title="No customer feedback reported"
            description="The main website has not returned a submission for this filter set."
          />
        )}
      </Card>
    </>
  );
}

export function FeedbackDetailPage({ id }: { id: string }) {
  const { admin } = useAdminSession();
  const canRead = hasPermission(admin?.roles ?? [], "analytics.read");
  const query = useAdminQuery(["feedback", id], (api) => api.feedback.detail(id), {
    enabled: canRead,
  });
  const feedback = query.data?.data.feedback;

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Command center" title="Feedback detail" />
        <QueryEmpty
          title="Permission required"
          description="Ask for analytics.read to inspect customer-submitted feedback."
        />
      </>
    );
  if (query.isLoading)
    return (
      <>
        <PageHeader eyebrow="Command center / Feedback" title="Feedback detail" />
        <QueryLoading label="Loading feedback…" />
      </>
    );
  if (query.error)
    return (
      <>
        <PageHeader eyebrow="Command center / Feedback" title="Feedback detail" />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  if (!feedback)
    return (
      <>
        <PageHeader eyebrow="Command center / Feedback" title="Feedback detail" />
        <QueryEmpty
          title="Feedback unavailable"
          description="The submission is absent or outside your current role scope."
        />
      </>
    );

  return (
    <>
      <PageHeader
        eyebrow="Command center / Customer feedback"
        title="Feedback detail"
        description="A read-only projection of a customer submission received by the main website."
        actions={
          <Link href="/feedback" className="button button-quiet">
            Back to feedback
          </Link>
        }
      />
      <div className="detail-grid">
        <Card>
          <div className="card-heading">
            <div>
              <h2>Customer rating</h2>
              <p>Rating values are bounded by the customer API to one through five stars.</p>
            </div>
            <Badge tone="info" icon="star">
              Read only
            </Badge>
          </div>
          <div className="detail-section feedback-detail-rating">
            <StarRating stars={feedback.stars} />
            <strong>{feedback.stars} / 5</strong>
          </div>
          <div className="detail-section feedback-message" aria-label="Customer message">
            {feedback.message}
          </div>
        </Card>
        <Card>
          <div className="card-heading">
            <div>
              <h2>Submission metadata</h2>
              <p>No customer credentials or payment data are included in this projection.</p>
            </div>
          </div>
          <dl className="detail-rows">
            <div className="detail-row">
              <dt>Feedback ID</dt>
              <dd>
                <code>{feedback.id}</code>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Customer ID</dt>
              <dd>
                <code>{feedback.user_id}</code>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Submitted</dt>
              <dd>{formatDate(feedback.created_at)}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}

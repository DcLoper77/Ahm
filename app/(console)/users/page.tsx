"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate, initials } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { useAdminSession } from "@/components/auth/session-context";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import {
  Badge,
  Button,
  Card,
  CursorPagination,
  DataTable,
  Field,
  PageHeader,
  SelectInput,
  TableColumn,
  TextInput,
} from "@/components/ui";
import type { CustomerUserSummary } from "@/lib/admin/types";

const emptyFilters = { email: "", status: "", sort_by: "created_at", sort_order: "desc" };

export default function UsersPage() {
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const canRead = hasPermission(admin?.roles ?? [], "users.read");
  const query = useAdminQuery(
    ["users", filters, cursor],
    (resourceApi) => resourceApi.users.list({ ...filters, cursor, limit: 25 }),
    { enabled: canRead },
  );

  const users = query.data?.data.users ?? [];
  const nextCursor = query.data?.data.next_cursor ?? null;
  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({ ...draftFilters });
    setCursorStack([undefined]);
  };
  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setCursorStack([undefined]);
  };
  const next = () => {
    if (nextCursor) setCursorStack((stack) => [...stack, nextCursor]);
  };
  const back = () => {
    if (cursorStack.length > 1) setCursorStack((stack) => stack.slice(0, -1));
  };
  const columns = useMemo<TableColumn<CustomerUserSummary>[]>(
    () => [
      {
        key: "identity",
        label: "Customer",
        render: (user) => (
          <Link href={`/users/${user.id}`} className="primary-cell">
            <span className="row-avatar">
              {initials(user.email ?? user.masked_email ?? user.id)}
            </span>
            <span className="primary-cell-copy">
              <strong>{user.email ?? user.masked_email ?? "Identity masked"}</strong>
              <small>{user.name ?? user.masked_name ?? user.id}</small>
            </span>
          </Link>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (user) => (
          <Badge
            tone={
              user.status === "ACTIVE"
                ? "success"
                : user.status === "SUSPENDED"
                  ? "danger"
                  : "neutral"
            }
          >
            {user.status}
          </Badge>
        ),
      },
      {
        key: "organizations",
        label: "Organizations",
        render: (user) => user.organization_count ?? "—",
      },
      {
        key: "version",
        label: "Version",
        render: (user) => <span className="mono">v{user.version}</span>,
      },
      {
        key: "updated",
        label: "Last updated",
        render: (user) => formatDate(user.updated_at ?? user.created_at),
      },
    ],
    [],
  );

  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Customers"
          title="Users"
          description="Customer identity access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="The backend will remain authoritative. Ask a platform administrator for users.read if this work is in your scope."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Users"
        description="Inspect customer identity and account state with role-minimized PII."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["users"] })}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Customer directory</h2>
            <p>
              Signed cursor pagination · server-side filters · no client-side identity enrichment
            </p>
          </div>
          <Badge tone="info" icon="lock">
            PII minimized
          </Badge>
        </div>
        <form className="filter-bar" onSubmit={applyFilters}>
          <Field label="Email address">
            <TextInput
              value={draftFilters.email}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="Exact normalized email"
              type="email"
            />
          </Field>
          <Field label="Status">
            <SelectInput
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DELETED">Deleted</option>
            </SelectInput>
          </Field>
          <Field label="Sort by">
            <SelectInput
              value={draftFilters.sort_by}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, sort_by: event.target.value }))
              }
            >
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
              <option value="email">Email</option>
            </SelectInput>
          </Field>
          <Field label="Direction">
            <SelectInput
              value={draftFilters.sort_order}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, sort_order: event.target.value }))
              }
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </SelectInput>
          </Field>
          <div className="filter-actions">
            <Button type="submit" variant="primary">
              Apply
            </Button>
            <Button type="button" variant="quiet" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </form>
        {query.isLoading ? (
          <QueryLoading label="Loading customer directory…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : users.length === 0 ? (
          <QueryEmpty
            title="No customers match"
            description="Try a different status or exact email filter. The API returned an empty page."
          />
        ) : (
          <>
            <DataTable
              caption="Customer users"
              rows={users}
              rowKey={(user) => user.id}
              columns={columns}
            />
            <div className="table-footer">
              <CursorPagination
                hasNext={Boolean(nextCursor)}
                canBack={cursorStack.length > 1}
                onNext={next}
                onBack={back}
                label="customer users"
              />
            </div>
          </>
        )}
      </Card>
    </>
  );
}

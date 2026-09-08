"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate } from "@/lib/admin/format";
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
import type { OrganizationSummary } from "@/lib/admin/types";

const emptyFilters = {
  state: "",
  plan_code: "",
  kind: "",
  owner_user_id: "",
  sort_by: "created_at",
  sort_order: "desc",
};

export default function OrganizationsPage() {
  const { admin } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.roles ?? [], "orgs.read");
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const query = useAdminQuery(
    ["organizations", filters, cursor],
    (api) => api.organizations.list({ ...filters, cursor, limit: 25 }),
    { enabled: canRead },
  );
  const organizations = query.data?.data.orgs ?? [];
  const nextCursor = query.data?.data.next_cursor ?? null;
  const columns = useMemo<TableColumn<OrganizationSummary>[]>(
    () => [
      {
        key: "organization",
        label: "Organization",
        render: (org) => (
          <Link href={`/organizations/${org.id}`} className="primary-cell">
            <span className="row-avatar">
              {(org.name ?? org.slug ?? "O").slice(0, 1).toUpperCase()}
            </span>
            <span className="primary-cell-copy">
              <strong>{org.name ?? "Unnamed organization"}</strong>
              <small>{org.slug ?? org.id}</small>
            </span>
          </Link>
        ),
      },
      {
        key: "state",
        label: "Service state",
        render: (org) => (
          <Badge
            tone={
              org.state === "ACTIVE" ? "success" : org.state === "SUSPENDED" ? "danger" : "warning"
            }
          >
            {org.state ?? "Not reported"}
          </Badge>
        ),
      },
      {
        key: "plan",
        label: "Plan",
        render: (org) => <Badge tone="neutral">{org.plan_code ?? "Not reported"}</Badge>,
      },
      { key: "kind", label: "Kind", render: (org) => org.kind ?? "—" },
      {
        key: "version",
        label: "Version",
        render: (org) => <span className="mono">{org.version ? `v${org.version}` : "—"}</span>,
      },
      {
        key: "updated",
        label: "Last updated",
        render: (org) => formatDate(org.updated_at ?? org.created_at),
      },
    ],
    [],
  );
  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({ ...draftFilters });
    setCursorStack([undefined]);
  };
  const clear = () => {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setCursorStack([undefined]);
  };
  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Customers"
          title="Organizations"
          description="Organization access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask a platform administrator for orgs.read to inspect organization state."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Organizations"
        description="Separate service state, billing state, ownership, and aggregate resource evidence."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["organizations"] })}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Organization directory</h2>
            <p>
              Signed cursor pagination · state filters are server-side · billing remains a separate
              projection
            </p>
          </div>
          <Badge tone="info" icon="building">
            Scoped view
          </Badge>
        </div>
        <form className="filter-bar" onSubmit={applyFilters}>
          <Field label="Owner user ID">
            <TextInput
              value={draftFilters.owner_user_id}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, owner_user_id: event.target.value }))
              }
              placeholder="Optional owner ID"
            />
          </Field>
          <Field label="Service state">
            <SelectInput
              value={draftFilters.state}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, state: event.target.value }))
              }
            >
              <option value="">All states</option>
              <option value="ACTIVE">Active</option>
              <option value="PAST_DUE">Past due</option>
              <option value="GRACE">Grace</option>
              <option value="READ_ONLY">Read only</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DELETING">Deleting</option>
              <option value="DELETED">Deleted</option>
            </SelectInput>
          </Field>
          <Field label="Plan">
            <SelectInput
              value={draftFilters.plan_code}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, plan_code: event.target.value }))
              }
            >
              <option value="">All plans</option>
              <option value="free">Free</option>
              <option value="developer">Developer</option>
              <option value="founder">Founder</option>
            </SelectInput>
          </Field>
          <Field label="Kind">
            <SelectInput
              value={draftFilters.kind}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, kind: event.target.value }))
              }
            >
              <option value="">All kinds</option>
              <option value="PERSONAL">Personal</option>
              <option value="TEAM">Team</option>
            </SelectInput>
          </Field>
          <Field label="Sort">
            <SelectInput
              value={draftFilters.sort_by}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, sort_by: event.target.value }))
              }
            >
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
              <option value="name">Name</option>
              <option value="slug">Slug</option>
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
          <QueryLoading label="Loading organizations…" />
        ) : query.error ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : organizations.length === 0 ? (
          <QueryEmpty
            title="No organizations match"
            description="Try a different state, plan, or owner filter."
          />
        ) : (
          <>
            <DataTable
              caption="Organizations"
              rows={organizations}
              rowKey={(org) => org.id}
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
                label="organizations"
              />
            </div>
          </>
        )}
      </Card>
    </>
  );
}

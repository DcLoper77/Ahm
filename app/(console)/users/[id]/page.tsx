"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { initials } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { useAdminSession } from "@/components/auth/session-context";
import { ConfirmActionModal } from "@/components/confirm-action";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import { AuditRef, RecordFacts, ResourceLink } from "@/components/record-view";
import { Badge, Button, Card, PageHeader, StatusBadge } from "@/components/ui";
import { UserTierAssignments } from "@/components/tiers-pages";

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { admin, runMutation } = useAdminSession();
  const canRead = hasPermission(admin?.permissions ?? [], "users.read");
  const canMutate = hasPermission(admin?.permissions ?? [], "users.suspend");
  const query = useAdminQuery(
    ["user", params.id],
    (resourceApi) => resourceApi.users.detail(params.id),
    { enabled: canRead },
  );
  const [action, setAction] = useState<"suspend" | "restore" | null>(null);
  const [result, setResult] = useState<{
    requestId?: string;
    status?: string;
    revoked?: number;
  } | null>(null);
  const user = query.data?.data.user;
  const organizations = query.data?.data.organizations ?? [];

  const submitAction = async (input: { reason?: string; expected_version?: number }) => {
    if (!action || !user) return;
    if (input.expected_version === undefined) {
      throw new Error("The current customer version is unavailable. Refresh before retrying.");
    }
    const response = await runMutation<Record<string, unknown>>({
      path: `/users/${encodeURIComponent(params.id)}:${action}`,
      body: {
        reason: input.reason ?? "",
        expected_version: input.expected_version,
      },
      step_up_action: `admin:user_${action}`,
    });
    setResult({
      requestId: response.request_id,
      status: typeof response.data.status === "string" ? response.data.status : undefined,
      revoked:
        typeof response.data.revoked_sessions === "number"
          ? response.data.revoked_sessions
          : undefined,
    });
    setAction(null);
    await queryClient.invalidateQueries({ queryKey: ["user", params.id] });
    await queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Customers"
          title="User detail"
          description="Customer identity access is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask a platform administrator for users.read to inspect this record."
        />
      </>
    );
  if (query.isLoading)
    return (
      <>
        <PageHeader eyebrow="Customers" title="User detail" />
        <QueryLoading label="Loading customer detail…" />
      </>
    );
  if (query.error)
    return (
      <>
        <PageHeader eyebrow="Customers" title="User detail" />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  if (!user)
    return (
      <>
        <PageHeader eyebrow="Customers" title="User detail" />
        <QueryEmpty
          title="Customer unavailable"
          description="The record is absent or outside your role scope."
        />
      </>
    );

  const identity = user.email ?? user.masked_email ?? "Identity masked";
  const currentVersion =
    typeof user.version === "number" && user.version >= 1 ? user.version : undefined;
  return (
    <>
      <PageHeader
        eyebrow="Customers / Users"
        title={identity}
        description="Role-minimized customer identity with organizations and durable account state."
        actions={
          <>
            <Button variant="quiet" icon="chevron-left" onClick={() => router.push("/users")}>
              Back to users
            </Button>
            {canMutate && currentVersion !== undefined ? (
              <Button
                variant={user.status === "SUSPENDED" ? "secondary" : "danger-quiet"}
                icon={user.status === "SUSPENDED" ? "play" : "pause"}
                onClick={() => setAction(user.status === "SUSPENDED" ? "restore" : "suspend")}
              >
                {user.status === "SUSPENDED" ? "Restore access" : "Suspend access"}
              </Button>
            ) : canMutate ? (
              <Badge tone="warning">Waiting for current version</Badge>
            ) : null}
          </>
        }
      />
      {result ? (
        <Card className="result-card">
          <div className="card-heading">
            <div>
              <h2>Action accepted</h2>
              <p>The durable customer projection is being refreshed.</p>
            </div>
            <AuditRef requestId={result.requestId} />
          </div>
          <div className="detail-section">
            <div className="metric-bar">
              <div className="metric-bar-item">
                <span>Reported status</span>
                <strong>{result.status ?? "Pending"}</strong>
              </div>
              <div className="metric-bar-item">
                <span>Sessions revoked</span>
                <strong>{result.revoked ?? "—"}</strong>
              </div>
              <div className="metric-bar-item">
                <span>Request</span>
                <strong className="mono">{result.requestId ?? "—"}</strong>
              </div>
            </div>
            <Button variant="quiet" icon="refresh" onClick={() => void query.refetch()}>
              Refresh projection
            </Button>
          </div>
        </Card>
      ) : null}
      <div className="detail-grid">
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Account state</h2>
                <p>Current version is required for guarded status changes.</p>
              </div>
              <StatusBadge value={user.status} />
            </div>
            <div className="detail-section">
              <div className="primary-cell">
                <span className="row-avatar">{initials(identity)}</span>
                <span className="primary-cell-copy">
                  <strong>{identity}</strong>
                  <small>{user.name ?? user.masked_name ?? "Customer identity"}</small>
                </span>
              </div>
              <RecordFacts
                record={user}
                fields={[
                  { key: "id", label: "Customer ID", kind: "id" },
                  { key: "status", label: "Status", kind: "status" },
                  { key: "version", label: "Version" },
                  { key: "created_at", label: "Created", kind: "date" },
                  { key: "updated_at", label: "Updated", kind: "date" },
                ]}
              />
            </div>
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <h2>Linked organizations</h2>
                <p>Organizations returned by the admin detail projection.</p>
              </div>
              <Badge tone="neutral">{organizations.length} linked</Badge>
            </div>
            {organizations.length ? (
              <div className="detail-section organization-links">
                {organizations.map((organization, index) => {
                  const id = typeof organization.id === "string" ? organization.id : `org-${index}`;
                  const name = typeof organization.name === "string" ? organization.name : id;
                  return (
                    <ResourceLink key={id} href={`/organizations/${id}`} label={name} id={id} />
                  );
                })}
              </div>
            ) : (
              <QueryEmpty
                title="No organizations linked"
                description="This customer detail response contains no organization links."
              />
            )}
          </Card>
        </div>
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Administrative guardrails</h2>
                <p>Actions remain server-authorized and audited.</p>
              </div>
            </div>
            <div className="detail-section">
              <p className="security-note">
                Suspending a customer revokes customer sessions and durably updates supported
                database effects. The control panel shows the accepted projection while those
                effects converge.
              </p>
              <div className="action-row" style={{ marginTop: 14 }}>
                <Link
                  href={`/audit?target_id=${encodeURIComponent(params.id)}`}
                  className="button button-quiet"
                >
                  <span>View audit history</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <h2>PII boundary</h2>
                <p>What this view deliberately does not contain.</p>
              </div>
              <Badge tone="success" icon="lock">
                Reviewed
              </Badge>
            </div>
            <div className="detail-section">
              <ul className="plain-list">
                <li>Passwords and session tokens</li>
                <li>Customer PATs and credentials</li>
                <li>Environment values and provider secrets</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
      <div className="stack" style={{ marginTop: 18 }}>
        <UserTierAssignments userId={params.id} organizations={organizations} />
      </div>
      {action ? (
        <ConfirmActionModal
          title={action === "suspend" ? "Suspend customer access" : "Restore customer access"}
          target={identity}
          description={
            action === "suspend"
              ? "This revokes customer sessions and creates durable infrastructure effects."
              : "This restores the account through the guarded status transition."
          }
          actionLabel={action === "suspend" ? "Suspend customer" : "Restore customer"}
          dangerous={action === "suspend"}
          expectedVersion={currentVersion}
          onConfirm={submitAction}
          onClose={() => setAction(null)}
        />
      ) : null}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate } from "@/lib/admin/format";
import { canGrantRole, roleLabel } from "@/lib/admin/rbac";
import { useAdminQuery } from "@/lib/admin/hooks";
import { useAdminSession } from "@/components/auth/session-context";
import { ConfirmActionModal } from "@/components/confirm-action";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Modal,
  ModalForm,
  PageHeader,
  TableColumn,
  TextInput,
  CopyValue,
  InlineAlert,
} from "@/components/ui";
import type {
  AdminInvitationResult,
  AdminInvitationSummary,
  AdminRole,
  AdminUserSummary,
} from "@/lib/admin/types";

const roles: AdminRole[] = [
  "ROOT",
  "PLATFORM_ADMIN",
  "SUPPORT_OPERATOR",
  "BILLING_ADMIN",
  "INFRA_ADMIN",
  "ANALYST",
];

function configuredAdminOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_HAVENERR_ADMIN_ORIGIN?.replace(/\/$/, "");
  if (configured) return configured;
  return typeof window !== "undefined"
    ? window.location.origin
    : "https://controlpanel.havenerr.com";
}

function InviteDialog({
  onClose,
  onCreated,
  grantorRoles,
}: {
  onClose: () => void;
  onCreated: (result: AdminInvitationResult) => void;
  grantorRoles: AdminRole[];
}) {
  const { runMutation } = useAdminSession();
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<AdminRole[]>(["SUPPORT_OPERATOR"]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const grantableRoles = roles.filter((role) => canGrantRole(grantorRoles, role));
  const submit = async () => {
    if (!email || !selected.length) {
      setError("Enter an email address and select at least one role.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await runMutation<AdminInvitationResult>({
        path: "/invitations",
        body: { email, roles: selected },
        step_up_action: "admin:invite",
      });
      onCreated(response.data);
      onClose();
    } catch (inviteError) {
      setError(
        inviteError instanceof Error ? inviteError.message : "The invitation could not be created.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal
      title="Invite an administrator"
      description="The invitation expires after 48 hours and returns a raw token exactly once."
      onClose={loading ? () => undefined : onClose}
      size="small"
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
              Create invitation
            </Button>
          </>
        }
      >
        {error ? (
          <InlineAlert tone="danger" title="Invitation not created">
            {error}
          </InlineAlert>
        ) : null}
        <Field label="Administrator email">
          <TextInput
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="operator@havenerr.com"
            required
            autoFocus
          />
        </Field>
        <div className="field">
          <span className="field-label">Immutable roles</span>
          <div className="role-check-grid">
            {grantableRoles.map((role) => (
              <label className="check-field" key={role}>
                <input
                  type="checkbox"
                  checked={selected.includes(role)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, role]
                        : current.filter((item) => item !== role),
                    )
                  }
                />{" "}
                {roleLabel(role)}
              </label>
            ))}
          </div>
          <span className="field-hint">
            Only roles whose complete immutable permission set is within your authority are shown.
            ROOT remains root protected.
          </span>
        </div>
      </ModalForm>
    </Modal>
  );
}

export default function AdminsPage() {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.roles ?? [], "admins.read");
  const canInvite = hasPermission(admin?.roles ?? [], "admins.invite");
  const adminsQuery = useAdminQuery(["admins"], (api) => api.admins.list(), { enabled: canRead });
  const invitationsQuery = useAdminQuery(["invitations"], (api) => api.invitations.list(), {
    enabled: canRead,
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState<AdminInvitationResult | null>(null);
  const [disableTarget, setDisableTarget] = useState<AdminUserSummary | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AdminUserSummary | null>(null);
  const adminRows = adminsQuery.data?.data.admins ?? [];
  const invitations = invitationsQuery.data?.data.invitations ?? [];
  const columns = useMemo<TableColumn<AdminUserSummary>[]>(
    () => [
      {
        key: "admin",
        label: "Administrator",
        render: (item) => (
          <span className="primary-cell">
            <span className="row-avatar">{item.email.charAt(0).toUpperCase()}</span>
            <span className="primary-cell-copy">
              <strong>{item.email}</strong>
              <small>{item.id}</small>
            </span>
          </span>
        ),
      },
      {
        key: "roles",
        label: "Roles",
        render: (item) => (
          <div className="badge-list">
            {item.roles.map((role) => (
              <Badge key={role} tone={role === "ROOT" ? "warning" : "neutral"}>
                {roleLabel(role)}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (item) => (
          <Badge tone={item.status === "ACTIVE" ? "success" : "danger"}>{item.status}</Badge>
        ),
      },
      {
        key: "version",
        label: "Version",
        render: (item) => <span className="mono">v{item.version}</span>,
      },
      { key: "sessions", label: "Sessions", render: (item) => item.session_count ?? "—" },
      {
        key: "actions",
        label: "",
        align: "right",
        render: (item) => {
          const hasVersion = typeof item.version === "number" && item.version >= 1;
          return canInvite && hasVersion && item.status === "ACTIVE" ? (
            <Button variant="danger-quiet" onClick={() => setDisableTarget(item)}>
              Disable
            </Button>
          ) : canInvite && hasVersion && item.status === "DISABLED" ? (
            <Button variant="secondary" onClick={() => setRestoreTarget(item)}>
              Restore
            </Button>
          ) : canInvite && (item.status === "ACTIVE" || item.status === "DISABLED") ? (
            <Badge tone="warning">Waiting for version</Badge>
          ) : null;
        },
      },
    ],
    [canInvite],
  );
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admins"] });
    void queryClient.invalidateQueries({ queryKey: ["invitations"] });
  };
  const disable = async (input: { expected_version?: number; reason?: string }) => {
    if (!disableTarget) return;
    const version =
      typeof disableTarget.version === "number" && disableTarget.version >= 1
        ? disableTarget.version
        : undefined;
    if (input.expected_version === undefined && version === undefined) {
      throw new Error("The current administrator version is unavailable. Refresh before retrying.");
    }
    await runMutation({
      path: `/admins/${encodeURIComponent(disableTarget.id)}:disable`,
      body: { expected_version: input.expected_version ?? version },
      step_up_action: "admin:disable_admin",
    });
    setDisableTarget(null);
    refresh();
  };
  const restore = async (input: { expected_version?: number }) => {
    if (!restoreTarget) return;
    const version =
      typeof restoreTarget.version === "number" && restoreTarget.version >= 1
        ? restoreTarget.version
        : undefined;
    if (input.expected_version === undefined && version === undefined) {
      throw new Error("The current administrator version is unavailable. Refresh before retrying.");
    }
    await runMutation({
      method: "PATCH",
      path: `/admins/${encodeURIComponent(restoreTarget.id)}`,
      body: { expected_version: input.expected_version ?? version, status: "ACTIVE" },
      step_up_action: "admin:restore_admin",
    });
    setRestoreTarget(null);
    refresh();
  };
  if (!canRead)
    return (
      <>
        <PageHeader
          eyebrow="Control"
          title="Administrators"
          description="Administrator management is not included in your current role."
        />
        <QueryEmpty
          title="Permission required"
          description="Ask for admins.read to inspect administrators and invitations."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Control"
        title="Administrators"
        description="Immutable roles, invitation lifecycle, and root protection remain visible at the edge of every action."
        actions={
          <>
            <Button
              variant="secondary"
              icon="refresh"
              onClick={refresh}
              loading={adminsQuery.isFetching || invitationsQuery.isFetching}
            >
              Refresh
            </Button>
            {canInvite ? (
              <Button variant="primary" icon="plus" onClick={() => setInviteOpen(true)}>
                Invite administrator
              </Button>
            ) : null}
          </>
        }
      />
      {inviteResult ? (
        <Card className="result-card">
          <div className="card-heading">
            <div>
              <h2>Invitation created</h2>
              <p>
                Copy the link now. The raw token is returned once and is not written to telemetry.
              </p>
            </div>
            <Badge tone="warning" icon="clock">
              Expires {formatDate(inviteResult.expires_at)}
            </Badge>
          </div>
          <div className="detail-section">
            <Field label="Invitation URL">
              <CopyValue
                value={`${configuredAdminOrigin()}/invite/${inviteResult.token}`}
                label="Copy invitation URL"
              />
            </Field>
            <p className="security-note">
              Send this link through an approved out-of-band channel. It will be removed from the
              address bar after the invited administrator opens it.
            </p>
            <Button variant="quiet" onClick={() => setInviteResult(null)}>
              Dismiss token view
            </Button>
          </div>
        </Card>
      ) : null}
      <div className="stack">
        <Card>
          <div className="card-heading">
            <div>
              <h2>Admin identities</h2>
              <p>Safe identity, role, status, version, and session metadata only.</p>
            </div>
            <Badge tone="info" icon="shield">
              Role aware
            </Badge>
          </div>
          {adminsQuery.isLoading ? (
            <QueryLoading label="Loading administrators…" />
          ) : adminsQuery.error ? (
            <QueryError error={adminsQuery.error} onRetry={() => void adminsQuery.refetch()} />
          ) : adminRows.length ? (
            <DataTable
              caption="Administrators"
              rows={adminRows}
              rowKey={(item) => item.id}
              columns={columns}
            />
          ) : (
            <QueryEmpty
              title="No administrators reported"
              description="The admin API returned an empty administrator projection."
            />
          )}
        </Card>
        <Card>
          <div className="card-heading">
            <div>
              <h2>Pending invitations</h2>
              <p>Invitation metadata never includes token material.</p>
            </div>
            <Badge tone="neutral">{invitations.length}</Badge>
          </div>
          {invitationsQuery.isLoading ? (
            <QueryLoading label="Loading invitations…" />
          ) : invitationsQuery.error ? (
            <QueryError
              error={invitationsQuery.error}
              onRetry={() => void invitationsQuery.refetch()}
            />
          ) : invitations.length ? (
            <div className="invitation-list">
              {invitations.map((invitation: AdminInvitationSummary) => {
                const invitationId = invitation.id ?? invitation.invitation_id;
                return (
                  <div className="invitation-row" key={invitationId ?? invitation.email}>
                    <div>
                      <strong>{invitation.email}</strong>
                      <span>{invitation.roles.map(roleLabel).join(" · ")}</span>
                    </div>
                    <div>
                      <small>Expires {formatDate(invitation.expires_at)}</small>
                      {invitationId ? (
                        <Button
                          variant="danger-quiet"
                          onClick={() =>
                            void runMutation({
                              path: `/invitations/${encodeURIComponent(invitationId)}:revoke`,
                              body: {},
                              step_up_action: "admin:revoke_invitation",
                            }).then(refresh)
                          }
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Badge tone="warning">Missing invitation ID</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <QueryEmpty
              title="No pending invitations"
              description="New administrator invitations will appear here until accepted, revoked, or expired."
            />
          )}
        </Card>
      </div>
      {inviteOpen ? (
        <InviteDialog
          onClose={() => setInviteOpen(false)}
          onCreated={setInviteResult}
          grantorRoles={admin?.roles ?? []}
        />
      ) : null}
      {disableTarget ? (
        <ConfirmActionModal
          title="Disable administrator"
          target={disableTarget.email}
          description="This rotates or revokes the administrator's sessions and is blocked if it would remove the final root path."
          actionLabel="Disable administrator"
          dangerous
          expectedVersion={disableTarget.version}
          reasonRequired={false}
          onConfirm={disable}
          onClose={() => setDisableTarget(null)}
        />
      ) : null}
      {restoreTarget ? (
        <ConfirmActionModal
          title="Restore administrator"
          target={restoreTarget.email}
          description="Restore the administrator's existing immutable roles after a fresh version check."
          actionLabel="Restore administrator"
          expectedVersion={restoreTarget.version}
          reasonRequired={false}
          onConfirm={restore}
          onClose={() => setRestoreTarget(null)}
        />
      ) : null}
    </>
  );
}

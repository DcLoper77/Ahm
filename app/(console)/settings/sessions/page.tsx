"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminSession } from "@/components/auth/session-context";
import { roleSummary } from "@/lib/admin/rbac";
import { formatDate, formatRelative } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/hooks";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/data-states";
import { Badge, Button, Card, Field, InlineAlert, PageHeader, TextInput } from "@/components/ui";

export default function SecurityPage() {
  const router = useRouter();
  const { admin, api, signOut, refreshSession, refreshMe, sessionIdleExpiresAt, runMutation } =
    useAdminSession();
  const queryClient = useQueryClient();
  const sessionsQuery = useAdminQuery(["auth", "sessions"], (authApi) => authApi.sessions(), {
    enabled: Boolean(admin),
  });
  const [recoveryCode, setRecoveryCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordRotated, setPasswordRotated] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const rotateRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.rotateRecoveryCodes(recoveryCode);
      setRecoveryCodes(result.data.recovery_codes);
      setRecoveryCode("");
    } catch (rotateError) {
      setError(
        rotateError instanceof Error ? rotateError.message : "Recovery codes could not be rotated.",
      );
    } finally {
      setLoading(false);
    }
  };
  const rotatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordRotated(false);
    if (newPassword.length < 16) {
      setPasswordError("The new password must be at least 16 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new password and confirmation do not match.");
      return;
    }
    setLoading(true);
    try {
      await runMutation({
        path: "/auth/password/rotate",
        body: { current_password: currentPassword, new_password: newPassword },
        step_up_action: "admin:password_rotate",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordRotated(true);
      await refreshMe();
    } catch (rotateError) {
      setPasswordError(
        rotateError instanceof Error
          ? rotateError.message
          : "Password rotation could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  };
  const revokeAll = async () => {
    setLoading(true);
    try {
      await api.revokeAll();
      await signOut();
    } catch {
      await signOut();
    } finally {
      setLoading(false);
    }
  };
  if (!admin) return null;
  const sessions = sessionsQuery.data?.data.sessions ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Control / Security"
        title="Security"
        description="Review your active sessions and MFA recovery material. Session tokens never enter application state."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() =>
              void Promise.all([
                queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] }),
                refreshSession(),
              ])
            }
            loading={sessionsQuery.isFetching}
          >
            Refresh sessions
          </Button>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Current administrator</h2>
            <p>{roleSummary(admin.roles)}</p>
          </div>
          <Badge tone={admin.mfa_enabled ? "success" : "warning"} icon="lock">
            {admin.mfa_enabled ? "MFA enabled" : "MFA enrollment required"}
          </Badge>
        </div>
        <div className="detail-section">
          <div className="detail-rows">
            <div className="detail-row">
              <dt>Email</dt>
              <dd>{admin.email}</dd>
            </div>
            <div className="detail-row">
              <dt>Admin ID</dt>
              <dd>
                <code>{admin.id}</code>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Session</dt>
              <dd>
                <code>{admin.session_id}</code>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Idle expiry</dt>
              <dd>
                {sessionIdleExpiresAt
                  ? formatDate(sessionIdleExpiresAt)
                  : "Reported by session cookie"}
              </dd>
            </div>
          </div>
          {!admin.mfa_enabled ? (
            <Button
              variant="primary"
              icon="shield"
              style={{ marginTop: 14 }}
              onClick={() => router.push("/mfa/enroll")}
            >
              Enroll MFA
            </Button>
          ) : null}
        </div>
      </Card>
      <div className="detail-grid" style={{ marginTop: 18 }}>
        <Card>
          <div className="card-heading">
            <div>
              <h2>Active sessions</h2>
              <p>Device metadata only; no session token material is returned.</p>
            </div>
            <Badge tone="neutral">{sessions.length}</Badge>
          </div>
          {sessionsQuery.isLoading ? (
            <QueryLoading label="Loading active sessions…" />
          ) : sessionsQuery.error ? (
            <QueryError error={sessionsQuery.error} onRetry={() => void sessionsQuery.refetch()} />
          ) : sessions.length ? (
            <div className="session-list">
              {sessions.map((session) => (
                <div className="session-row" key={session.id}>
                  <div className="session-icon">
                    <span className="status-dot status-dot-blue" />
                  </div>
                  <div className="session-copy">
                    <strong>{session.current ? "This browser" : "Administrator session"}</strong>
                    <span>
                      Last seen {formatRelative(session.last_seen_at)} · created{" "}
                      {formatDate(session.created_at)}
                    </span>
                    <small>
                      Idle expiry {formatDate(session.idle_expires_at)} · absolute expiry{" "}
                      {formatDate(session.absolute_expires_at)}
                    </small>
                  </div>
                  <div>
                    {session.current ? (
                      <Badge tone="success">Current</Badge>
                    ) : (
                      <Button
                        variant="danger-quiet"
                        onClick={() =>
                          void runMutation({
                            path: `/auth/sessions/${encodeURIComponent(session.id)}:revoke`,
                            body: {},
                            step_up_action: "admin:revoke_session",
                          }).then(() => void sessionsQuery.refetch())
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <QueryEmpty
              title="No sessions reported"
              description="The admin API returned no active device metadata."
            />
          )}
          <div className="detail-section session-footer">
            <Button
              variant="danger-quiet"
              icon="logout"
              onClick={() => void revokeAll()}
              loading={loading}
            >
              Revoke all sessions
            </Button>
            <p className="field-hint">
              This includes the current browser and returns you to login.
            </p>
          </div>
        </Card>
        {admin.roles.includes("ROOT") ? (
          <Card>
            <div className="card-heading">
              <div>
                <h2>Rotate root password</h2>
                <p>Root-only, MFA protected, audited, and revokes every other admin session.</p>
              </div>
              <Badge tone="danger" icon="shield">
                Root only
              </Badge>
            </div>
            <div className="detail-section">
              {passwordRotated ? (
                <InlineAlert tone="success" title="Password rotated">
                  Other sessions were revoked; this current session remains active.
                </InlineAlert>
              ) : null}
              {passwordError ? (
                <InlineAlert tone="danger" title="Password not rotated">
                  {passwordError}
                </InlineAlert>
              ) : null}
              <form className="auth-form" onSubmit={(event) => void rotatePassword(event)}>
                <Field label="Current password">
                  <TextInput
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </Field>
                <Field
                  label="New password"
                  hint="Use 16–1024 characters and choose a value different from the current password."
                >
                  <TextInput
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={16}
                    required
                  />
                </Field>
                <Field label="Confirm new password">
                  <TextInput
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={16}
                    required
                  />
                </Field>
                <Button type="submit" variant="danger" loading={loading}>
                  Rotate password
                </Button>
              </form>
            </div>
          </Card>
        ) : null}
        <div className="stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2>Recovery codes</h2>
                <p>Rotation invalidates all unused codes and returns replacements once.</p>
              </div>
              <Badge tone="warning" icon="key">
                Sensitive
              </Badge>
            </div>
            <div className="detail-section">
              {error ? (
                <InlineAlert tone="danger" title="Recovery code rotation failed">
                  {error}
                </InlineAlert>
              ) : null}
              {recoveryCodes ? (
                <>
                  <InlineAlert tone="warning" title="Save these codes now">
                    They are shown once and are not retained after this view is left.
                  </InlineAlert>
                  <div className="recovery-grid">
                    {recoveryCodes.map((code) => (
                      <code className="recovery-code" key={code}>
                        {code}
                      </code>
                    ))}
                  </div>
                </>
              ) : null}
              <form className="auth-form" onSubmit={(event) => void rotateRecovery(event)}>
                <Field label="Current MFA code">
                  <TextInput
                    value={recoveryCode}
                    onChange={(event) =>
                      setRecoveryCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    required
                  />
                </Field>
                <Button type="submit" variant="secondary" loading={loading}>
                  Rotate recovery codes
                </Button>
              </form>
            </div>
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <h2>Security model</h2>
                <p>Browser-visible controls are UX only.</p>
              </div>
            </div>
            <div className="detail-section">
              <ul className="plain-list">
                <li>Admin session is an opaque HttpOnly cookie.</li>
                <li>Mutations echo the readable CSRF cookie.</li>
                <li>Fresh MFA is requested for high-impact mutations.</li>
                <li>Role and permission checks remain server authoritative.</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

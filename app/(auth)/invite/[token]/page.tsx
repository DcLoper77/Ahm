"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminApiError } from "@/lib/admin/errors";
import { useAdminSession } from "@/components/auth/session-context";
import { Button, Field, InlineAlert, TextInput } from "@/components/ui";

export default function InvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { runMutation, refreshMe } = useAdminSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Remove the bearer token from the visible address bar after Next has read it.
    if (typeof window !== "undefined") window.history.replaceState(null, "", "/invite");
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < 16) {
      setError("Your password must be at least 16 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await runMutation({
        path: `/invitations/${encodeURIComponent(params.token)}:accept`,
        body: { password },
      });
      await refreshMe();
      router.replace("/mfa/enroll");
    } catch (acceptError) {
      setError(
        acceptError instanceof AdminApiError
          ? acceptError.message
          : "This invitation could not be accepted.",
      );
    } finally {
      setLoading(false);
      setPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand">
          <span className="brand-mark">H</span>
          <span className="brand-wordmark">
            havenerr<span>.</span>
          </span>
        </div>
        <div className="auth-visual-copy">
          <span className="auth-kicker">Administrator invitation</span>
          <h1>A considered start for trusted operators.</h1>
          <p>Set a strong password, then enroll MFA before the control panel becomes available.</p>
        </div>
        <div className="auth-visual-footer">
          Invitation links expire after 48 hours and can only be accepted once.
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-progress">
            <span className="is-active" />
            <span />
          </div>
          <h2>Create your password</h2>
          <p>Your invited role is fixed by the issuer. MFA enrollment is the next required step.</p>
          {error ? (
            <InlineAlert tone="danger" title="Invitation not accepted">
              {error}
            </InlineAlert>
          ) : null}
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <Field
              label="Password"
              htmlFor="invite-password"
              hint="Use 16–1024 characters. Do not reuse a customer password."
            >
              <TextInput
                id="invite-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                autoFocus
                required
              />
            </Field>
            <Field label="Confirm password" htmlFor="invite-password-confirm">
              <TextInput
                id="invite-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            <Button type="submit" variant="primary" loading={loading} className="auth-submit">
              Accept invitation
            </Button>
          </form>
          <p className="auth-footnote">
            The invitation token is used only for this acceptance request and is removed from the
            address bar after the screen loads.
          </p>
        </div>
      </section>
    </div>
  );
}

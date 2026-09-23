"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminApiError } from "@/lib/admin/errors";
import { useAdminSession } from "@/components/auth/session-context";
import { Button, Card, CopyValue, Field, InlineAlert, TextInput } from "@/components/ui";

export default function MfaEnrollPage() {
  const router = useRouter();
  const { status, runMutation, refreshMe } = useAdminSession();
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauth_uri: string } | null>(
    null,
  );
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEnrollment = useCallback(async () => {
    setError(null);
    setEnrollmentLoading(true);
    try {
      const result = await runMutation<{ secret: string; otpauth_uri: string }>({
        path: "/auth/mfa/enroll",
        body: {},
        step_up_action: "admin:mfa_enroll",
      });
      setEnrollment(result.data);
    } catch (enrollError) {
      setError(
        enrollError instanceof AdminApiError
          ? enrollError.message
          : "MFA enrollment could not start.",
      );
    } finally {
      setEnrollmentLoading(false);
    }
  }, [runMutation]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated" || enrollment) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadEnrollment();
    });
    return () => {
      cancelled = true;
    };
  }, [enrollment, loadEnrollment, status]);

  const confirm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six digit code shown by your authenticator.");
      return;
    }
    setLoading(true);
    try {
      const result = await runMutation<{ recovery_codes: string[] }>({
        path: "/auth/mfa/confirm",
        body: { code },
        step_up_action: "admin:mfa_confirm",
      });
      setRecoveryCodes(result.data.recovery_codes);
      await refreshMe();
    } catch (confirmError) {
      setError(
        confirmError instanceof AdminApiError
          ? confirmError.message
          : "MFA confirmation could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!recoveryCodes) return;
    const blob = new Blob([`Havenerr admin recovery codes\n\n${recoveryCodes.join("\n")}\n`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "havenerr-admin-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
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
          <span className="auth-kicker">Security setup</span>
          <h1>Make every action accountable.</h1>
          <p>
            Before business routes are available, your administrator account needs a TOTP
            authenticator and one-time recovery codes.
          </p>
        </div>
        <div className="auth-visual-footer">
          MFA enrollment is required for invited administrators.
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-progress">
            <span className="is-active" />
            <span className="is-active" />
          </div>
          {recoveryCodes ? (
            <>
              <h2>Save your recovery codes</h2>
              <p>
                These codes are shown once. Store them in an approved password manager or secure
                offline location.
              </p>
              <InlineAlert tone="warning" title="One-time recovery codes">
                Each code can be used once. They are not stored in this browser.
              </InlineAlert>
              <div className="recovery-grid">
                {recoveryCodes.map((recoveryCode) => (
                  <CopyValue key={recoveryCode} value={recoveryCode} label="Copy recovery code" />
                ))}
              </div>
              <div className="page-header-actions" style={{ marginTop: 18 }}>
                <Button variant="secondary" icon="download" onClick={download}>
                  Download codes
                </Button>
                <Button variant="primary" icon="arrow-right" onClick={() => router.replace("/")}>
                  Continue to control panel
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2>Enroll MFA</h2>
              <p>
                Scan the setup URI with your authenticator, then confirm with the six digit code it
                generates.
              </p>
              {error ? (
                <InlineAlert tone="danger" title="MFA setup was not completed">
                  {error}
                </InlineAlert>
              ) : null}
              {error && !enrollment ? (
                <Button
                  variant="secondary"
                  onClick={() => void loadEnrollment()}
                  loading={enrollmentLoading}
                >
                  Retry MFA setup
                </Button>
              ) : null}
              <Card className="mfa-card">
                <div className="qr-placeholder" aria-hidden="true">
                  Authenticator setup
                </div>
                <Field
                  label="Setup secret"
                  hint="Keep this value private and do not paste it into support channels."
                  staticContent
                >
                  <CopyValue
                    value={
                      enrollment?.secret ??
                      (enrollmentLoading ? "Loading setup secret…" : "MFA setup unavailable")
                    }
                    label="Copy setup secret"
                  />
                </Field>
                <Field
                  label="Authenticator URI"
                  hint="Use this only in an approved authenticator."
                  staticContent
                >
                  <CopyValue
                    value={
                      enrollment?.otpauth_uri ??
                      (enrollmentLoading ? "Loading setup URI…" : "MFA setup unavailable")
                    }
                    label="Copy authenticator URI"
                  />
                </Field>
              </Card>
              <form className="auth-form" onSubmit={(event) => void confirm(event)}>
                <Field label="Confirmation code" htmlFor="mfa-code">
                  <TextInput
                    id="mfa-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  disabled={!enrollment || enrollmentLoading}
                  className="auth-submit"
                >
                  Confirm MFA
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

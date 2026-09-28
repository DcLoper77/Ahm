"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AdminApiError } from "@/lib/admin/errors";
import { useAdminSession } from "@/components/auth/session-context";
import { Button, Field, InlineAlert, TextInput } from "@/components/ui";

function safeReturnTo(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, admin, signIn } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [mfaMode, setMfaMode] = useState(params.get("mfa") === "1");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [throttleMessage, setThrottleMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && admin && !params.get("mfa"))
      router.replace(safeReturnTo(params.get("returnTo")));
  }, [admin, params, router, status]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setThrottleMessage(null);
    if (!email || !password || (mfaMode && !totpCode && !recoveryCode)) {
      setError(
        mfaMode
          ? "Enter your email, password, and an MFA or recovery code."
          : "Enter your admin email and password.",
      );
      return;
    }
    setLoading(true);
    try {
      const result = await signIn({
        email,
        password,
        ...(totpCode ? { totp_code: totpCode } : {}),
        ...(recoveryCode ? { recovery_code: recoveryCode } : {}),
      });
      if (result.mfa_enrollment_required) router.replace("/mfa/enroll");
      else router.replace(safeReturnTo(params.get("returnTo")));
    } catch (loginError) {
      if (loginError instanceof AdminApiError && loginError.code === "ADMIN_MFA_REQUIRED") {
        setMfaMode(true);
        setError("Your account requires a current MFA code before access is granted.");
      } else if (
        loginError instanceof AdminApiError &&
        loginError.code === "ADMIN_LOGIN_THROTTLED"
      ) {
        const seconds = loginError.retryAfterMs
          ? Math.ceil(loginError.retryAfterMs / 1000)
          : undefined;
        setThrottleMessage(
          seconds ? `Try again in about ${seconds} seconds.` : "Try again after the wait period.",
        );
        setError(loginError.message);
      } else {
        setError(
          loginError instanceof AdminApiError
            ? loginError.message
            : "Sign in could not be completed.",
        );
      }
    } finally {
      setLoading(false);
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
          <span className="auth-kicker">Administrative control</span>
          <h1>Clarity for every important decision.</h1>
          <p>
            Operate customer state, infrastructure, and billing through one calm, accountable
            command center.
          </p>
          <div className="auth-signal-row">
            <span className="auth-signal">
              <span className="status-dot status-dot-green" /> Credentialed access
            </span>
            <span className="auth-signal">
              <span className="status-dot status-dot-blue" /> Audit aware
            </span>
            <span className="auth-signal">
              <span className="status-dot status-dot-green" /> MFA protected
            </span>
          </div>
        </div>
        <div className="auth-visual-footer">
          Havenerr Control Panel · {new Date().getFullYear()}
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-progress">
            <span className="is-active" />
            <span className={mfaMode ? "is-active" : ""} />
          </div>
          <h2>{mfaMode ? "Verify your identity" : "Welcome back"}</h2>
          <p>
            {mfaMode
              ? "Use a current code from your authenticator. A recovery code can be used once."
              : "Sign in to the Havenerr administrative control panel."}
          </p>
          {error ? (
            <InlineAlert tone="danger" title="Sign in was not completed">
              {error}
              {throttleMessage ? <span>{throttleMessage}</span> : null}
            </InlineAlert>
          ) : null}
          <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
            <Field label="Admin email" htmlFor="email">
              <TextInput
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                autoFocus={!mfaMode}
                placeholder="operator@havenerr.com"
                required
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <TextInput
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            {mfaMode ? (
              <>
                <Field
                  label="MFA code"
                  htmlFor="totp-code"
                  hint="Six digits from your authenticator app."
                >
                  <TextInput
                    id="totp-code"
                    value={totpCode}
                    onChange={(event) => {
                      setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                      setRecoveryCode("");
                    }}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </Field>
                <Field
                  label="Recovery code"
                  htmlFor="recovery-code"
                  hint="Use this only if you cannot access your authenticator."
                >
                  <TextInput
                    id="recovery-code"
                    value={recoveryCode}
                    onChange={(event) => {
                      setRecoveryCode(event.target.value);
                      setTotpCode("");
                    }}
                    autoComplete="off"
                  />
                </Field>
              </>
            ) : null}
            <Button type="submit" variant="primary" loading={loading} className="auth-submit">
              {mfaMode ? "Verify and enter" : "Sign in"}
            </Button>
          </form>
          <p className="auth-footnote">
            Access is limited to authorized Havenerr administrators. Sessions use secure, host-only
            cookies and are never stored in browser storage.
          </p>
          <p className="auth-footnote">
            <Link href="/invite">Have an invitation?</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

function LoginLoading() {
  return (
    <div className="shell-loading">
      <div className="shell-loading-mark">H</div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}

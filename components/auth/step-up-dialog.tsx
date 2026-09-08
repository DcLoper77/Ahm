"use client";

import { useState } from "react";
import { AdminApiError } from "@/lib/admin/errors";
import { useAdminSession, type StepUpCredentials } from "./session-context";
import { Button, Field, InlineAlert, Modal, ModalForm, TextInput } from "../ui";

export function StepUpDialog() {
  const { stepUpPrompt } = useAdminSession();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!stepUpPrompt) return null;

  const submit = async () => {
    setError(null);
    if (!password || (!code && !recoveryCode)) {
      setError("Enter your password and either a current MFA code or a recovery code.");
      return;
    }
    setLoading(true);
    const credentials: StepUpCredentials = { email: stepUpPrompt.email, password };
    if (recoveryCode) credentials.recovery_code = recoveryCode;
    else credentials.totp_code = code;
    try {
      await stepUpPrompt.continue(credentials);
      setPassword("");
      setCode("");
      setRecoveryCode("");
    } catch (stepUpError) {
      setError(
        stepUpError instanceof AdminApiError
          ? stepUpError.message
          : "Fresh verification could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Fresh verification required"
      description={`Confirm your identity before ${stepUpPrompt.action.replaceAll("_", " ")}. This proof is valid for 10 minutes.`}
      onClose={loading ? () => undefined : stepUpPrompt.cancel}
      size="small"
    >
      <ModalForm
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={stepUpPrompt.cancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              Verify and continue
            </Button>
          </>
        }
      >
        {error ? (
          <InlineAlert tone="danger" title="Verification not completed">
            {error}
          </InlineAlert>
        ) : null}
        <Field label="Admin email">
          <TextInput value={stepUpPrompt.email} readOnly autoComplete="username" />
        </Field>
        <Field label="Password">
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </Field>
        <Field
          label="MFA code"
          hint="Use a six digit code, or leave this blank to use a recovery code."
        >
          <TextInput
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setRecoveryCode("");
            }}
            inputMode="numeric"
            pattern="[0-9]{6}"
            autoComplete="one-time-code"
          />
        </Field>
        <Field label="Recovery code">
          <TextInput
            value={recoveryCode}
            onChange={(event) => {
              setRecoveryCode(event.target.value);
              setCode("");
            }}
            autoComplete="off"
          />
        </Field>
        <p className="security-note">
          The recovery code is consumed when accepted. Verification values are sent only to the
          admin login route and are not retained.
        </p>
      </ModalForm>
    </Modal>
  );
}

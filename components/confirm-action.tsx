"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { Button, Field, InlineAlert, Modal, ModalForm, TextArea, TextInput } from "./ui";

export function ConfirmActionModal({
  title,
  target,
  description,
  actionLabel,
  reasonRequired = true,
  reasonHint,
  expectedVersion,
  dangerous = false,
  moneyMoving = false,
  onConfirm,
  onClose,
}: {
  title: string;
  target: string;
  description: string;
  actionLabel: string;
  reasonRequired?: boolean;
  reasonHint?: string;
  expectedVersion?: number;
  dangerous?: boolean;
  moneyMoving?: boolean;
  onConfirm: (input: { reason?: string; expected_version?: number }) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [version, setVersion] = useState(expectedVersion ? String(expectedVersion) : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError(null);
    if (reasonRequired && reason.trim().length < 3) {
      setError("Add a reason with at least 3 characters.");
      return;
    }
    const parsedVersion = Number(version);
    if (
      expectedVersion !== undefined &&
      (!version || !Number.isInteger(parsedVersion) || parsedVersion < 1)
    ) {
      setError("Confirm the current record version before continuing.");
      return;
    }
    setLoading(true);
    try {
      await onConfirm({
        ...(reasonRequired || reason ? { reason: reason.trim() } : {}),
        ...(expectedVersion !== undefined ? { expected_version: parsedVersion } : {}),
      });
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "The action could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal
      title={title}
      description={description}
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
            <Button
              type="submit"
              variant={dangerous || moneyMoving ? "danger" : "primary"}
              loading={loading}
            >
              {actionLabel}
            </Button>
          </>
        }
      >
        {dangerous || moneyMoving ? (
          <div className="danger-callout">
            <Icon name="alert" size={16} />
            <div>
              <strong>{moneyMoving ? "Money-moving action" : "Destructive action"}</strong>
              <span>Review before you continue. {target} will be changed through a durable, audited admin operation.</span>
            </div>
          </div>
        ) : null}
        {error ? (
          <InlineAlert tone="danger" title="Action not completed">
            {error}
          </InlineAlert>
        ) : null}
        <Field label="Exact target">
          <TextInput value={target} readOnly />
        </Field>
        {expectedVersion !== undefined ? (
          <Field
            label="Current version"
            hint="The action is guarded by optimistic concurrency. Refresh if this value changed."
          >
            <TextInput
              type="number"
              min="1"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </Field>
        ) : null}
        {reasonRequired || reasonHint ? (
          <Field
            label="Reason"
            hint={reasonHint ?? "This reason is retained with the audit result."}
          >
            <TextArea
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 500))}
              minLength={reasonRequired ? 3 : undefined}
              maxLength={500}
              required={reasonRequired}
              placeholder="Describe the operational reason"
            />
          </Field>
        ) : null}
      </ModalForm>
    </Modal>
  );
}

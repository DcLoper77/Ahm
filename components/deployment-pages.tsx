"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminSession } from "@/components/auth/session-context";
import { ConfirmActionModal } from "@/components/confirm-action";
import { QueryError, QueryLoading } from "@/components/data-states";
import { AdminApiError } from "@/lib/admin/errors";
import { useAdminQuery } from "@/lib/admin/hooks";
import { operationMutations } from "@/lib/admin/api";
import { hasPermission } from "@/lib/admin/rbac";
import type {
  ConfigChange,
  ConfigRevertBody,
  ConfigSaveBody,
  ConfigSaveResult,
  ConfigValidateBody,
  ConfigValidationResult,
  DeploymentOperation,
  DeploymentRequestBody,
  DeploymentRollbackBody,
  DeploymentCancelBody,
  OperationAccepted,
  SecretCreateBody,
  SecretReasonBody,
  SecretReplaceBody,
  SecretRevealResult,
  SecretSummary,
  SecretWriteResult,
} from "@/lib/admin/types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  InlineAlert,
  PageHeader,
  SelectInput,
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/ui";

const deploymentStages = [
  ["FETCHING", "Fetch approved repository revision"],
  ["PREPARING", "Prepare isolated release"],
  ["INSTALLING", "Install locked dependencies"],
  ["VALIDATING", "Typecheck and lint"],
  ["BUILDING", "Build and run tests"],
  ["PRE_RESTART_CHECK", "Validate config and migration compatibility"],
  ["ACTIVATING", "Switch release pointer"],
  ["RESTARTING", "Restart Havenerr"],
  ["HEALTH_CHECKING", "Verify liveness, readiness, and revision"],
  ["ROLLING_BACK", "Restore previous known-good release"],
] as const;

const cancellableStates = new Set([
  "QUEUED",
  "FETCHING",
  "PREPARING",
  "INSTALLING",
  "VALIDATING",
  "BUILDING",
  "PRE_RESTART_CHECK",
]);
const terminalStates = new Set(["SUCCEEDED", "FAILED", "ROLLED_BACK", "CANCELLED"]);
const shortSha = (value?: string | null) => (value ? value.slice(0, 12) : "—");
const formatTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");
function secretValueError(value: string): string | null {
  if (value.length < 4) return "Secret values must contain at least 4 characters.";
  if (new TextEncoder().encode(value).byteLength > 64 * 1024)
    return "Secret values must be no larger than 64 KiB in UTF-8.";
  if (
    value
      .split(/[\r\n]/)
      .map((line) => line.trim())
      .filter(Boolean)
      .some((line) => line.length < 4)
  )
    return "Each non-empty secret line must contain at least 4 characters.";
  return null;
}
const retryTransientAdminRead = (failureCount: number, error: unknown) =>
  failureCount < 2 && error instanceof AdminApiError && error.retryable;
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function elapsed(operation: DeploymentOperation): string {
  const started = Date.parse(operation.started_at ?? operation.requested_at);
  const finished = operation.finished_at ? Date.parse(operation.finished_at) : Date.now();
  if (!Number.isFinite(started) || !Number.isFinite(finished)) return "—";
  const seconds = Math.max(0, Math.floor((finished - started) / 1000));
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function OperationLogs({ id }: { id: string }) {
  const { api } = useAdminSession();
  const [lines, setLines] = useState<
    Array<{ at: string; phase: string; stream: string; text: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0);
  const polling = useRef(false);
  const output = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    let stopped = false;
    offset.current = 0;
    polling.current = false;

    const poll = async () => {
      if (stopped || polling.current) return;
      polling.current = true;
      try {
        const result = await api.operations.logs(id, offset.current);
        if (stopped) return;
        if (result.data.next_offset > offset.current) {
          offset.current = result.data.next_offset;
          setLines((current) => [...current, ...result.data.lines].slice(-2500));
        }
        setError(null);
      } catch (cause) {
        if (!stopped)
          setError(errorMessage(cause, "Logs are temporarily unavailable. Reconnecting…"));
      } finally {
        polling.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [api, id]);

  useEffect(() => {
    if (output.current) output.current.scrollTop = output.current.scrollHeight;
  }, [lines.length]);

  return (
    <Card>
      <div className="section-heading">
        <div>
          <h3>Sanitized deployment log</h3>
          <p>Text only. New lines are fetched by offset so refresh and reconnect resume safely.</p>
        </div>
        <StatusBadge value={error ? "RECONNECTING" : "LIVE"} />
      </div>
      {error ? <InlineAlert tone="warning">{error}</InlineAlert> : null}
      <pre
        ref={output}
        className="ops-log"
        aria-label="Deployment log output"
        aria-live="polite"
        style={{
          maxHeight: 420,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {lines.length
          ? lines
              .map((line) => `${line.at} [${line.phase}] ${line.stream}: ${line.text}\n`)
              .join("")
          : "Waiting for deployment output…"}
      </pre>
    </Card>
  );
}

export function DeployPage() {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "deploy.read");
  const canWrite = hasPermission(admin?.permissions ?? [], "deploy.write");
  const status = useAdminQuery(["deploy", "status"], (api) => api.operations.status(), {
    enabled: canRead,
    refetchInterval: 3000,
  });
  const remote = useAdminQuery(["deploy", "remote"], (api) => api.operations.remote(), {
    enabled: canRead,
    refetchInterval: 60_000,
  });
  const history = useAdminQuery(["deploy", "history"], (api) => api.operations.history(), {
    enabled: canRead,
    refetchInterval: 10_000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<DeploymentOperation | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<DeploymentOperation | null>(null);
  const [rollbackConfirmation, setRollbackConfirmation] = useState("");
  const [rollbackReason, setRollbackReason] = useState("");
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = status.data?.data.active_operation;
  const deployments = history.data?.data.deployments ?? [];
  const shownId = selectedId ?? active?.id ?? deployments[0]?.id ?? null;
  const detail = useAdminQuery(
    ["deploy", "detail", shownId],
    (api) => api.operations.detail(shownId!),
    { enabled: canRead && Boolean(shownId), refetchInterval: 3000 },
  );
  const operation = detail.data?.data ?? (active?.id === shownId ? active : undefined);
  const current = status.data?.data.active;
  const preview = remote.data?.data;
  const refresh = async () => {
    await Promise.all([status.refetch(), remote.refetch(), history.refetch()]);
  };

  if (!canRead)
    return (
      <InlineAlert tone="danger">Your role cannot inspect production deployments.</InlineAlert>
    );
  if (status.isLoading && !status.data) return <QueryLoading label="Loading production runtime" />;

  const operationsWorkerReady =
    status.data?.data.operations_worker.status === "active" &&
    status.data.data.operations_worker.unit_file_state === "enabled";
  const deployAvailable = Boolean(
    canWrite &&
    operationsWorkerReady &&
    current &&
    preview &&
    !preview.diverged &&
    preview.ahead !== 0 &&
    !active &&
    !busy,
  );
  const showReconnect = Boolean(status.error || remote.error || history.error);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Production"
        title="Deploy Havenerr"
        description="Review the exact Git revision before activating a backend release. Polling never deploys automatically."
        actions={<Button onClick={() => void refresh()}>Refresh</Button>}
      />

      {showReconnect ? (
        <InlineAlert tone="warning" title="Reconnecting to the operations API">
          The current release remains in control. This page will resume from the durable operation
          journal when the API responds.
        </InlineAlert>
      ) : null}
      {status.error && !status.data ? (
        <QueryError error={status.error} onRetry={() => void status.refetch()} />
      ) : null}
      {status.data && !operationsWorkerReady ? (
        <InlineAlert tone="warning" title="Deployment worker unavailable">
          The Havenerr operations worker is not active. Deployment, rollback, and restart requests
          are disabled until its systemd service recovers.
        </InlineAlert>
      ) : null}

      <div className="detail-grid">
        <Card>
          <h3>Current production</h3>
          {current ? (
            <>
              <p>
                <StatusBadge value={status.data?.data.systemd.status ?? "UNKNOWN"} /> systemd
                service
              </p>
              <p>
                Commit <strong className="mono">{current.commit_sha}</strong>
              </p>
              <p>
                Release <span className="mono">{current.release_id}</span> · Branch {current.branch}
              </p>
              <p>
                Built {formatTime(current.built_at)} · Uptime{" "}
                {status.data?.data.systemd.uptime_ms
                  ? `${Math.floor(status.data.data.systemd.uptime_ms / 1000)} seconds`
                  : "—"}
              </p>
              <p>
                Readiness <StatusBadge value={status.data?.data.readiness ?? "UNKNOWN"} /> · Serving{" "}
                {shortSha(status.data?.data.serving_commit)}
              </p>
              {status.data?.data.revision_matches_active === false ? (
                <InlineAlert tone="warning">
                  The systemd service is not yet serving the release selected by the current
                  pointer.
                </InlineAlert>
              ) : null}
              <p>
                Deployment worker{" "}
                <StatusBadge value={status.data?.data.operations_worker.status ?? "UNKNOWN"} />
                {status.data?.data.operations_worker.restart_count
                  ? ` · ${status.data.data.operations_worker.restart_count} restarts`
                  : ""}
              </p>
            </>
          ) : (
            <InlineAlert tone="warning">
              No verified release is active. Bootstrap one known-good release over SSH before using
              Dashboard deployment.
            </InlineAlert>
          )}
        </Card>

        <Card>
          <h3>Configured repository</h3>
          {remote.error ? (
            <InlineAlert tone="warning">
              Remote metadata is temporarily unavailable. Production is unchanged.
            </InlineAlert>
          ) : null}
          {preview ? (
            <>
              <p>
                Candidate <strong className="mono">{preview.candidate_sha}</strong>
              </p>
              <p>
                Branch {preview.branch} · {preview.candidate_title || "No commit title"}
              </p>
              <p>
                {preview.diverged
                  ? "The configured branch diverged from production. Review the history before taking action."
                  : preview.ahead === 0
                    ? "Production is up to date."
                    : `${preview.ahead ?? "First"} newer commit${preview.ahead === 1 ? "" : "s"} available.`}
              </p>
              <p>Checked {formatTime(preview.checked_at)}</p>
              <Button
                variant="primary"
                disabled={!deployAvailable}
                onClick={() => setConfirmDeploy(true)}
              >
                Deploy {shortSha(preview.candidate_sha)}
              </Button>
              {!current ? (
                <p>Dashboard deployment requires a bootstrapped known-good release for rollback.</p>
              ) : null}
            </>
          ) : (
            <p>
              {remote.isFetching
                ? "Checking the configured branch…"
                : "No repository preview is available."}
            </p>
          )}
        </Card>
      </div>

      {preview?.commits.length ? (
        <Card>
          <h3>Commits since production</h3>
          <ul className="stack">
            {preview.commits.map((commit) => (
              <li key={commit.sha}>
                <span className="mono">{commit.sha}</span> {commit.title} · {commit.author} ·{" "}
                {formatTime(commit.committed_at)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {operation ? (
        <Card>
          <div className="section-heading">
            <div>
              <h3>Operation {operation.id}</h3>
              <p>
                {operation.kind} · Requested {formatTime(operation.requested_at)} · Elapsed{" "}
                {elapsed(operation)}
              </p>
            </div>
            <StatusBadge value={operation.state} />
          </div>
          <ol aria-label="Deployment progress" className="stack">
            {deploymentStages.map(([stage, label]) => {
              const complete = Boolean(operation.steps?.[stage]);
              const currentStage =
                operation.current_step === stage && !terminalStates.has(operation.state);
              return (
                <li key={stage} aria-current={currentStage ? "step" : undefined}>
                  <span aria-hidden="true">{complete ? "✓" : currentStage ? "●" : "○"}</span>{" "}
                  {label}
                  {operation.steps?.[stage] ? (
                    <small> · {formatTime(operation.steps[stage])}</small>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p>
            Previous commit {shortSha(operation.previous_commit)} · Resulting active commit{" "}
            {shortSha(operation.resulting_active_revision)}
          </p>
          {operation.failure_stage ? <p>Failure stage: {operation.failure_stage}</p> : null}
          {operation.safe_error ? (
            <InlineAlert
              tone={operation.rollback_state === "FAILED" ? "danger" : "warning"}
              title={
                operation.rollback_state === "FAILED"
                  ? "Recovery needs break-glass review"
                  : "Operation outcome"
              }
            >
              {operation.safe_error}{" "}
              {operation.resulting_active_revision
                ? `Active commit: ${shortSha(operation.resulting_active_revision)}.`
                : ""}
            </InlineAlert>
          ) : null}
          {operation.steps?.ACTIVATING ? (
            <p>The production pointer changed during this operation.</p>
          ) : (
            <p>The production pointer was not changed before activation.</p>
          )}
          {canWrite && operation.kind === "DEPLOY" && cancellableStates.has(operation.state) ? (
            <Button variant="secondary" onClick={() => setCancelTarget(operation)}>
              Request safe cancellation
            </Button>
          ) : null}
        </Card>
      ) : null}

      {shownId ? <OperationLogs key={shownId} id={shownId} /> : null}

      <Card>
        <div className="section-heading">
          <div>
            <h3>Deployment history</h3>
            <p>
              Only releases created and retained by this deployment system can be selected for
              rollback.
            </p>
          </div>
          {history.isFetching ? <StatusBadge value="REFRESHING" /> : null}
        </div>
        {history.error ? (
          <InlineAlert tone="warning">
            History is temporarily unavailable. Refresh to reconnect.
          </InlineAlert>
        ) : null}
        {deployments.length === 0 ? (
          <EmptyState
            title="No deployment history"
            description="Completed and active operations will appear here."
          />
        ) : (
          <div className="stack">
            {deployments.map((item) => (
              <div className="section-heading" key={item.id}>
                <Button variant="quiet" onClick={() => setSelectedId(item.id)}>
                  {item.kind} · {shortSha(item.candidate_sha ?? item.resulting_active_revision)} ·{" "}
                  {item.state} · {formatTime(item.requested_at)}
                </Button>
                {canWrite &&
                item.kind === "DEPLOY" &&
                item.state === "SUCCEEDED" &&
                item.release_id ? (
                  <Button
                    variant="secondary"
                    disabled={!operationsWorkerReady}
                    onClick={() => {
                      setRollbackTarget(item);
                      setRollbackConfirmation("");
                      setRollbackReason("");
                      setRollbackError(null);
                    }}
                  >
                    Roll back to {shortSha(item.candidate_sha)}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      {confirmDeploy && preview ? (
        <ConfirmActionModal
          title="Deploy reviewed commit"
          target={`${current?.commit_sha ?? "No current release"} → ${preview.candidate_sha}`}
          description={`This will restart the production API after candidate preflight. ${preview.ahead ?? 0} commit(s) are included.`}
          actionLabel={`Deploy ${shortSha(preview.candidate_sha)}`}
          reasonHint="Enter at least 8 characters. The reason is audited after redaction."
          onClose={() => setConfirmDeploy(false)}
          onConfirm={async ({ reason }) => {
            const cleaned = reason?.trim() ?? "";
            if (cleaned.length < 8) throw new Error("Enter a reason with at least 8 characters.");
            setBusy(true);
            try {
              const result = await runMutation<OperationAccepted, DeploymentRequestBody>(
                operationMutations.deploy({
                  candidate_sha: preview.candidate_sha,
                  reason: cleaned,
                }),
              );
              setSelectedId(result.data.operation_id);
              setConfirmDeploy(false);
              await queryClient.invalidateQueries({ queryKey: ["deploy"] });
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {cancelTarget ? (
        <ConfirmActionModal
          title="Cancel before activation"
          target={`${cancelTarget.id} · ${cancelTarget.current_step}`}
          description="Cancellation is only accepted before the activation stage. The server journal remains authoritative."
          actionLabel="Request cancellation"
          reasonHint="Enter at least 8 characters."
          onClose={() => setCancelTarget(null)}
          onConfirm={async ({ reason }) => {
            const cleaned = reason?.trim() ?? "";
            if (cleaned.length < 8) throw new Error("Enter a reason with at least 8 characters.");
            const result = await runMutation<
              { operation_id: string; cancellation_requested: boolean },
              DeploymentCancelBody
            >(operationMutations.cancel(cancelTarget.id, cleaned));
            setSelectedId(result.data.operation_id);
            setCancelTarget(null);
            await queryClient.invalidateQueries({ queryKey: ["deploy"] });
          }}
        />
      ) : null}

      {rollbackTarget ? (
        <Card>
          <h3>Manual rollback confirmation</h3>
          <p>
            Target retained release <span className="mono">{rollbackTarget.release_id}</span> at
            commit <span className="mono">{rollbackTarget.candidate_sha}</span>.
          </p>
          <p>This will restart Havenerr and verify readiness before reporting success.</p>
          <Field label="Type ROLLBACK to continue">
            <TextInput
              value={rollbackConfirmation}
              onChange={(event) => setRollbackConfirmation(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field
            label="Reason"
            hint="Enter at least 8 characters; the backend redacts known operator values before audit."
          >
            <TextArea
              value={rollbackReason}
              maxLength={500}
              onChange={(event) => setRollbackReason(event.target.value)}
            />
          </Field>
          {rollbackError ? <InlineAlert tone="danger">{rollbackError}</InlineAlert> : null}
          <div className="button-row">
            <Button
              variant="danger"
              loading={busy}
              disabled={
                !operationsWorkerReady ||
                rollbackConfirmation !== "ROLLBACK" ||
                rollbackReason.trim().length < 8
              }
              onClick={() => {
                setBusy(true);
                void runMutation<OperationAccepted, DeploymentRollbackBody>(
                  operationMutations.rollback(rollbackTarget.release_id!, rollbackReason.trim()),
                )
                  .then(async (result) => {
                    setSelectedId(result.data.operation_id);
                    setRollbackTarget(null);
                    await queryClient.invalidateQueries({ queryKey: ["deploy"] });
                  })
                  .catch((cause: unknown) =>
                    setRollbackError(errorMessage(cause, "Rollback request failed.")),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Request rollback
            </Button>
            <Button variant="quiet" disabled={busy} onClick={() => setRollbackTarget(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function ConfigurationPage() {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "config.read");
  const canWrite = hasPermission(admin?.permissions ?? [], "config.write");
  const config = useAdminQuery(["ops", "config"], (api) => api.operations.config(), {
    enabled: canRead,
  });
  const [draftState, setDraftState] = useState<{
    revision: string;
    values: Record<string, string | undefined>;
  } | null>(null);
  const [addKey, setAddKey] = useState("");
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState<ConfigValidationResult | null>(null);
  const [validatedChangesKey, setValidatedChangesKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);

  const original = useMemo(
    () =>
      Object.fromEntries(
        (config.data?.data.entries ?? [])
          .filter((entry) => entry.editable)
          .map((entry) => [entry.key, entry.value ?? ""]),
      ),
    [config.data?.data.entries],
  );
  const savedRevision = config.data?.data.saved_revision ?? "";
  const draft = draftState?.revision === savedRevision ? draftState.values : original;
  const updateDraft = (
    update: (current: Record<string, string | undefined>) => Record<string, string | undefined>,
  ) => {
    if (!savedRevision) return;
    setDraftState((current) => ({
      revision: savedRevision,
      values: update(current?.revision === savedRevision ? current.values : original),
    }));
  };
  const changes = useMemo<ConfigChange[]>(() => {
    const keys = new Set([...Object.keys(original), ...Object.keys(draft)]);
    return [...keys].sort().flatMap((key) => {
      const before = Object.hasOwn(original, key) ? original[key] : undefined;
      const after = draft[key];
      return before === after ? [] : [{ key, value: after === undefined ? null : after }];
    });
  }, [draft, original]);
  const changesKey = JSON.stringify(changes);
  const validationCurrent = validatedChangesKey === changesKey;
  const availableKeys = (config.data?.data.editable_keys ?? []).filter(
    (key) => !Object.hasOwn(draft, key),
  );

  if (!canRead)
    return <InlineAlert tone="danger">Your role cannot inspect runtime configuration.</InlineAlert>;
  if (config.isLoading && !config.data)
    return <QueryLoading label="Loading runtime configuration" />;
  if (config.error && !config.data)
    return <QueryError error={config.error} onRetry={() => void config.refetch()} />;

  const validate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runMutation<ConfigValidationResult, ConfigValidateBody>(
        operationMutations.validateConfig({ changes }),
      );
      setValidation(result.data);
      setValidatedChangesKey(changesKey);
      if (!result.data.valid)
        setError(`Configuration needs changes: ${result.data.issues.join(", ")}`);
    } catch (cause) {
      setError(errorMessage(cause, "Configuration validation failed."));
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (changes.length === 0) return;
    const cleaned = reason.trim();
    if (cleaned.length < 8) {
      setError("Enter a reason with at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: ConfigSaveBody = {
        changes,
        expected_revision: config.data!.data.saved_revision,
        reason: cleaned,
      };
      await runMutation<ConfigSaveResult, ConfigSaveBody>(operationMutations.saveConfig(body));
      setReason("");
      setValidation(null);
      setValidatedChangesKey("");
      setDraftState(null);
      await queryClient.invalidateQueries({ queryKey: ["ops", "config"] });
    } catch (cause) {
      setError(errorMessage(cause, "Configuration could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const resetDraft = () => {
    const view = config.data?.data;
    if (view) setDraftState(null);
    setReason("");
    setValidation(null);
    setValidatedChangesKey("");
    setError(null);
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="System"
        title="Runtime configuration"
        description="Edit only the server allowlist. Secret-bearing keys stay masked and are managed through Secret Files."
        actions={<Button onClick={() => void config.refetch()}>Refresh</Button>}
      />
      {config.error ? (
        <InlineAlert tone="warning">
          Saved state could not be refreshed. Your current draft remains on this page.
        </InlineAlert>
      ) : null}
      {config.data?.data.restart_required ? (
        <InlineAlert tone="warning" title="Restart required">
          Saved revision {shortSha(config.data.data.saved_revision)} differs from loaded revision{" "}
          {shortSha(config.data.data.running_revision)}.
        </InlineAlert>
      ) : null}
      <Card>
        <h3>Configuration revisions</h3>
        <p>
          Saved <span className="mono">{config.data?.data.saved_revision}</span>
        </p>
        <p>
          Loaded at boot{" "}
          <span className="mono">{config.data?.data.running_revision || "Unavailable"}</span>
        </p>
        <p>
          {changes.length
            ? `${changes.length} unsaved change${changes.length === 1 ? "" : "s"}`
            : "No unsaved changes"}
        </p>
      </Card>

      <Card>
        <h3>Protected configuration</h3>
        <div className="stack">
          {(config.data?.data.entries ?? [])
            .filter((entry) => !entry.editable)
            .map((entry) => (
              <div className="section-heading" key={entry.key}>
                <span>{entry.key}</span>
                <StatusBadge value="MASKED" label={entry.value === null ? "Masked" : "Protected"} />
              </div>
            ))}
        </div>
      </Card>

      <Card>
        <h3>Editable values</h3>
        {Object.keys(draft).length === 0 ? (
          <EmptyState
            title="No editable values"
            description="The current config contains no keys from the editor allowlist."
          />
        ) : null}
        <div className="stack">
          {Object.entries(draft)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => (
              <div className="detail-grid" key={key}>
                <Field label={key}>
                  <TextInput
                    value={value ?? ""}
                    maxLength={2048}
                    onChange={(event) =>
                      updateDraft((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </Field>
                <div className="field-actions">
                  <Button
                    variant="quiet"
                    disabled={!canWrite || busy}
                    onClick={() =>
                      updateDraft((current) => {
                        const next = { ...current };
                        delete next[key];
                        return next;
                      })
                    }
                  >
                    Remove key
                  </Button>
                </div>
              </div>
            ))}
        </div>
        <div className="button-row">
          <Field label="Add allowlisted key">
            <SelectInput value={addKey} onChange={(event) => setAddKey(event.target.value)}>
              <option value="">Choose a key…</option>
              {availableKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Button
            disabled={!canWrite || busy || !addKey}
            onClick={() => {
              updateDraft((current) => ({ ...current, [addKey]: "" }));
              setAddKey("");
            }}
          >
            Add key
          </Button>
        </div>
      </Card>

      <Card>
        <h3>Validate and save</h3>
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        {validationCurrent && validation?.valid ? (
          <InlineAlert tone="success">Candidate configuration passed validation.</InlineAlert>
        ) : null}
        {validationCurrent && validation && !validation.valid ? (
          <ul>
            {validation.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        <div className="button-row">
          <Button
            variant="secondary"
            disabled={busy}
            loading={busy}
            onClick={() => void validate()}
          >
            Validate candidate
          </Button>
          <Button variant="quiet" disabled={busy || changes.length === 0} onClick={resetDraft}>
            Discard changes
          </Button>
          <Button
            variant="secondary"
            disabled={!canWrite || busy || changes.length === 0}
            onClick={() => setConfirmRevert(true)}
          >
            Revert previous version
          </Button>
        </div>
        <form className="stack" onSubmit={(event) => void save(event)}>
          <Field
            label="Save reason"
            hint="At least 8 characters. The backend redacts known operator values before audit."
          >
            <TextArea
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={!canWrite || busy || changes.length === 0 || reason.trim().length < 8}
          >
            Save configuration
          </Button>
        </form>
      </Card>

      {confirmRevert && config.data ? (
        <ConfirmActionModal
          title="Restore previous configuration"
          target={`Saved revision ${shortSha(config.data.data.saved_revision)}`}
          description="The prior private version will replace the saved runtime file. Restart Havenerr afterward to load it."
          actionLabel="Restore prior config"
          reasonHint="Enter at least 8 characters."
          onClose={() => setConfirmRevert(false)}
          onConfirm={async ({ reason: confirmReason }) => {
            const cleaned = confirmReason?.trim() ?? "";
            if (cleaned.length < 8) throw new Error("Enter a reason with at least 8 characters.");
            const body: ConfigRevertBody = {
              expected_revision: config.data!.data.saved_revision,
              reason: cleaned,
            };
            await runMutation<ConfigSaveResult, ConfigRevertBody>(
              operationMutations.revertConfig(body),
            );
            setConfirmRevert(false);
            resetDraft();
            await queryClient.invalidateQueries({ queryKey: ["ops", "config"] });
          }}
        />
      ) : null}
    </div>
  );
}

type SecretAction = "replace" | "delete" | "revert" | "reveal";

export function SecretFilesPage() {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "secrets.read");
  const canWrite = hasPermission(admin?.permissions ?? [], "secrets.write");
  const canReveal = hasPermission(admin?.permissions ?? [], "secrets.reveal");
  const secrets = useAdminQuery(["ops", "secrets"], (api) => api.operations.secrets(), {
    enabled: canRead,
    refetchInterval: 30_000,
  });
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [action, setAction] = useState<{ kind: SecretAction; name: string } | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [actionValue, setActionValue] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [revealed, setRevealed] = useState<SecretRevealResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = secrets.data?.data.secrets ?? [];

  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(null), 30_000);
    const hideWhenBackgrounded = () => {
      if (document.hidden) setRevealed(null);
    };
    document.addEventListener("visibilitychange", hideWhenBackgrounded);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", hideWhenBackgrounded);
    };
  }, [revealed]);

  if (!canRead)
    return <InlineAlert tone="danger">Your role cannot inspect managed secret files.</InlineAlert>;
  if (secrets.isLoading && !secrets.data)
    return <QueryLoading label="Loading secret file metadata" />;
  if (secrets.error && !secrets.data)
    return <QueryError error={secrets.error} onRetry={() => void secrets.refetch()} />;

  const refresh = async () => {
    await secrets.refetch();
  };
  const resetAction = () => {
    setAction(null);
    setConfirmName("");
    setActionValue("");
    setActionReason("");
    setError(null);
  };

  const createSecret = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = newReason.trim();
    if (reason.length < 8) {
      setError("Enter a reason with at least 8 characters.");
      return;
    }
    const valueError = secretValueError(newValue);
    if (valueError) {
      setError(valueError);
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await runMutation<SecretWriteResult, SecretCreateBody>(
        operationMutations.createSecret({ name: newName.trim(), value: newValue, reason }),
      );
      setNewName("");
      setNewValue("");
      setNewReason("");
      setNotice("Secret file created. Restart Havenerr to load the new value.");
      await queryClient.invalidateQueries({ queryKey: ["ops", "secrets"] });
      await queryClient.invalidateQueries({ queryKey: ["ops", "runtime"] });
    } catch (cause) {
      setError(errorMessage(cause, "Secret file could not be created."));
    } finally {
      setBusy(false);
    }
  };

  const submitSecretAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!action) return;
    const reason = actionReason.trim();
    if (reason.length < 8) {
      setError("Enter a reason with at least 8 characters.");
      return;
    }
    if (action.kind !== "reveal" && confirmName !== action.name) {
      setError("Type the exact filename to confirm this action.");
      return;
    }
    const replaceValueError = action.kind === "replace" ? secretValueError(actionValue) : null;
    if (replaceValueError) {
      setError(replaceValueError);
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (action.kind === "replace") {
        await runMutation<SecretWriteResult, SecretReplaceBody>(
          operationMutations.replaceSecret(action.name, { value: actionValue, reason }),
        );
        setNotice(`${action.name} replaced. Restart Havenerr to load the new value.`);
      } else if (action.kind === "delete") {
        await runMutation<SecretWriteResult, SecretReasonBody>(
          operationMutations.deleteSecret(action.name, { reason }),
        );
        setNotice(`${action.name} deleted. Restart Havenerr to apply the change.`);
      } else if (action.kind === "revert") {
        await runMutation<SecretWriteResult, SecretReasonBody>(
          operationMutations.revertSecret(action.name, { reason }),
        );
        setNotice(`${action.name} restored from its private history. Restart Havenerr to load it.`);
      } else {
        const result = await runMutation<SecretRevealResult, SecretReasonBody>(
          operationMutations.revealSecret(action.name, { reason }),
        );
        setRevealed(result.data);
        setNotice(null);
      }
      resetAction();
      await queryClient.invalidateQueries({ queryKey: ["ops", "secrets"] });
      await queryClient.invalidateQueries({ queryKey: ["ops", "runtime"] });
    } catch (cause) {
      setError(errorMessage(cause, "The secret file action could not be completed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="System"
        title="Secret files"
        description="Only filename and metadata are listed. Values are never preloaded into the page."
        actions={<Button onClick={() => void refresh()}>Refresh</Button>}
      />
      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
      {notice ? <InlineAlert tone="success">{notice}</InlineAlert> : null}
      {secrets.error ? (
        <InlineAlert tone="warning">
          Secret metadata could not be refreshed. Retry to reconnect.
        </InlineAlert>
      ) : null}

      {revealed ? (
        <Card>
          <div className="section-heading">
            <div>
              <h3>One-time reveal · {revealed.name}</h3>
              <p>
                This value is held in page memory for up to 30 seconds and clears when the tab is
                backgrounded.
              </p>
            </div>
            <Button variant="quiet" onClick={() => setRevealed(null)}>
              Hide now
            </Button>
          </div>
          <pre style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap", userSelect: "text" }}>
            {revealed.value}
          </pre>
        </Card>
      ) : null}

      {canWrite ? (
        <Card>
          <h3>Create secret file</h3>
          <form className="stack" onSubmit={(event) => void createSecret(event)}>
            <Field
              label="Filename"
              hint="One simple filename; no path segments. Up to 100 managed files."
            >
              <TextInput
                value={newName}
                maxLength={64}
                pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
                autoComplete="off"
                onChange={(event) => setNewName(event.target.value)}
              />
            </Field>
            <Field
              label="Secret value"
              hint="Use at least 4 characters and no more than 64 KiB in UTF-8. The value is sent once and is not included in the response or audit record."
            >
              <TextInput
                type="password"
                value={newValue}
                minLength={4}
                maxLength={65536}
                autoComplete="new-password"
                spellCheck={false}
                onChange={(event) => setNewValue(event.target.value)}
              />
            </Field>
            <Field label="Creation reason">
              <TextArea
                value={newReason}
                maxLength={500}
                onChange={(event) => setNewReason(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              disabled={
                busy ||
                newName.trim().length === 0 ||
                Boolean(secretValueError(newValue)) ||
                newReason.trim().length < 8
              }
            >
              Create secret file
            </Button>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="section-heading">
          <div>
            <h3>Managed files</h3>
            <p>{items.length} of 100 files</p>
          </div>
          <StatusBadge value="VALUES HIDDEN" />
        </div>
        {items.length === 0 ? (
          <EmptyState
            title="No managed secret files"
            description="Create a file after confirming its runtime purpose and rotation owner."
          />
        ) : (
          <div className="stack">
            {items.map((item: SecretSummary) => (
              <div className="section-heading" key={item.name}>
                <div>
                  <strong className="mono">{item.name}</strong>
                  <p>
                    Updated {formatTime(item.updated_at)} · {item.size_bytes.toLocaleString()} bytes
                  </p>
                </div>
                <div className="button-row">
                  {canReveal ? (
                    <Button
                      variant="quiet"
                      onClick={() => {
                        setRevealed(null);
                        setAction({ kind: "reveal", name: item.name });
                        setActionReason("");
                        setError(null);
                      }}
                    >
                      Reveal once
                    </Button>
                  ) : null}
                  {canWrite ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRevealed(null);
                        setAction({ kind: "replace", name: item.name });
                        setConfirmName("");
                        setActionValue("");
                        setActionReason("");
                        setError(null);
                      }}
                    >
                      Replace
                    </Button>
                  ) : null}
                  {canWrite ? (
                    <Button
                      variant="quiet"
                      onClick={() => {
                        setRevealed(null);
                        setAction({ kind: "revert", name: item.name });
                        setConfirmName("");
                        setActionReason("");
                        setError(null);
                      }}
                    >
                      Restore prior
                    </Button>
                  ) : null}
                  {canWrite ? (
                    <Button
                      variant="danger-quiet"
                      onClick={() => {
                        setRevealed(null);
                        setAction({ kind: "delete", name: item.name });
                        setConfirmName("");
                        setActionReason("");
                        setError(null);
                      }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {action ? (
        <Card>
          <h3>
            {action.kind === "reveal"
              ? "Reveal one secret"
              : `${action.kind[0]?.toUpperCase()}${action.kind.slice(1)} ${action.name}`}
          </h3>
          <p>
            {action.kind === "reveal"
              ? "A fresh MFA step-up is required. The value will appear only after the audited one-time request."
              : "This action is audited and changes a private file. Restart Havenerr afterward to load the result."}
          </p>
          {action.kind !== "reveal" ? (
            <Field label={`Type ${action.name} to confirm`}>
              <TextInput
                value={confirmName}
                autoComplete="off"
                onChange={(event) => setConfirmName(event.target.value)}
              />
            </Field>
          ) : null}
          {action.kind === "replace" ? (
            <Field
              label="New secret value"
              hint="Use at least 4 characters and no more than 64 KiB in UTF-8."
            >
              <TextInput
                type="password"
                value={actionValue}
                minLength={4}
                maxLength={65536}
                autoComplete="new-password"
                spellCheck={false}
                onChange={(event) => setActionValue(event.target.value)}
              />
            </Field>
          ) : null}
          <form className="stack" onSubmit={(event) => void submitSecretAction(event)}>
            <Field
              label="Reason"
              hint="Enter at least 8 characters. Known operator values are redacted before audit."
            >
              <TextArea
                value={actionReason}
                maxLength={500}
                onChange={(event) => setActionReason(event.target.value)}
              />
            </Field>
            <div className="button-row">
              <Button
                type="submit"
                variant={action.kind === "delete" ? "danger" : "primary"}
                loading={busy}
                disabled={
                  busy ||
                  actionReason.trim().length < 8 ||
                  (action.kind !== "reveal" && confirmName !== action.name) ||
                  (action.kind === "replace" && Boolean(secretValueError(actionValue)))
                }
              >
                {action.kind === "reveal"
                  ? "Reveal once"
                  : action.kind === "replace"
                    ? "Replace file"
                    : action.kind === "delete"
                      ? "Delete file"
                      : "Restore prior version"}
              </Button>
              <Button type="button" variant="quiet" disabled={busy} onClick={resetAction}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

export function RuntimePage() {
  const { admin, runMutation } = useAdminSession();
  const queryClient = useQueryClient();
  const canRead = hasPermission(admin?.permissions ?? [], "deploy.read");
  const canRestart = hasPermission(admin?.permissions ?? [], "runtime.restart");
  const runtime = useAdminQuery(["ops", "runtime"], (api) => api.operations.runtime(), {
    enabled: canRead,
    refetchInterval: 2000,
    retry: retryTransientAdminRead,
  });
  const history = useAdminQuery(["deploy", "history"], (api) => api.operations.history(), {
    enabled: canRead,
    refetchInterval: 5000,
    retry: retryTransientAdminRead,
  });
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = runtime.data?.data.active_operation;
  const lastRestart = history.data?.data.deployments.find((item) => item.kind === "RESTART");
  const operationId =
    selectedOperationId ?? (active?.kind === "RESTART" ? active.id : lastRestart?.id) ?? null;
  const operation = useAdminQuery(
    ["ops", "runtime-operation", operationId],
    (api) => api.operations.detail(operationId!),
    {
      enabled: canRead && Boolean(operationId),
      refetchInterval: 2000,
      retry: retryTransientAdminRead,
    },
  );

  if (!canRead)
    return <InlineAlert tone="danger">Your role cannot inspect runtime status.</InlineAlert>;
  if (runtime.isLoading && !runtime.data)
    return <QueryLoading label="Connecting to the Havenerr runtime" />;

  const status = runtime.data?.data;
  const currentOperation =
    operation.data?.data ?? (active?.id === operationId ? active : undefined);
  const operationsWorkerReady =
    status?.operations_worker.status === "active" &&
    status.operations_worker.unit_file_state === "enabled";
  const apiUnavailable = Boolean(runtime.error);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="System"
        title="Runtime and restart"
        description="Inspect the Havenerr systemd service, then wait for readiness and exact revision confirmation after a restart."
        actions={
          <Button
            onClick={() => {
              void runtime.refetch();
              void history.refetch();
            }}
          >
            Refresh
          </Button>
        }
      />
      {apiUnavailable ? (
        <InlineAlert tone="warning" title="Reconnecting to Havenerr">
          The API may be restarting or temporarily unreachable. This page keeps polling and will
          confirm success only after readiness returns.
        </InlineAlert>
      ) : null}
      {status ? (
        <Card>
          <h3>Backend service</h3>
          <p>
            <StatusBadge value={status.systemd.status} /> · {status.systemd.service_name} · boot{" "}
            {status.systemd.unit_file_state} · PID {status.systemd.pid || "—"}
          </p>
          <p>
            Readiness <StatusBadge value={status.readiness} /> · Uptime{" "}
            {status.systemd.uptime_ms
              ? `${Math.floor(status.systemd.uptime_ms / 1000)} seconds`
              : "—"}
          </p>
          <p>
            Operations worker <StatusBadge value={status.operations_worker.status} /> ·{" "}
            {status.operations_worker.service_name}· boot {status.operations_worker.unit_file_state}
            {status.operations_worker.restart_count
              ? ` · ${status.operations_worker.restart_count} restarts`
              : ""}
          </p>
          <p>
            Current release {shortSha(status.active?.commit_sha)} · Process serves{" "}
            {shortSha(status.serving_commit)}
          </p>
          <p>
            Revision check{" "}
            {status.revision_matches_active ? (
              <StatusBadge value="MATCH" />
            ) : (
              <StatusBadge value="MISMATCH" />
            )}
          </p>
          {status.revision_matches_active === false ? (
            <InlineAlert tone="danger">
              The systemd service is not serving the release selected by the current pointer.
            </InlineAlert>
          ) : null}
        </Card>
      ) : null}
      {runtime.error && !runtime.data ? (
        <QueryError error={runtime.error} onRetry={() => void runtime.refetch()} />
      ) : null}

      {currentOperation ? (
        <Card>
          <div className="section-heading">
            <div>
              <h3>Restart operation {currentOperation.id}</h3>
              <p>
                {currentOperation.current_step} · Requested{" "}
                {formatTime(currentOperation.requested_at)}
              </p>
            </div>
            <StatusBadge value={currentOperation.state} />
          </div>
          {currentOperation.safe_error ? (
            <InlineAlert tone="danger">{currentOperation.safe_error}</InlineAlert>
          ) : null}
          {currentOperation.state === "SUCCEEDED" &&
          status?.readiness === "ready" &&
          status.revision_matches_active ? (
            <InlineAlert tone="success">
              Restart completed. Readiness is restored and the exact active revision is serving.
            </InlineAlert>
          ) : !terminalStates.has(currentOperation.state) ? (
            <InlineAlert tone="info">
              Waiting for the API to reconnect and verify readiness…
            </InlineAlert>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <h3>Restart Havenerr</h3>
        <p>
          Active requests can briefly disconnect. The Admin session is retained when it remains
          valid; this page reconnects and checks readiness before reporting success.
        </p>
        <Button
          variant="primary"
          disabled={
            !canRestart ||
            !operationsWorkerReady ||
            busy ||
            Boolean(active && !terminalStates.has(active.state))
          }
          onClick={() => setConfirmRestart(true)}
        >
          Restart backend
        </Button>
      </Card>

      {confirmRestart ? (
        <ConfirmActionModal
          title="Restart Havenerr backend"
          target={`${status?.systemd.service_name ?? "Unknown service"} · ${shortSha(status?.active?.commit_sha)}`}
          description="Only the configured Havenerr systemd service will restart. Saved runtime configuration and managed secret-file changes will become active."
          actionLabel="Queue restart"
          reasonHint="Enter at least 8 characters."
          onClose={() => setConfirmRestart(false)}
          onConfirm={async ({ reason }) => {
            const cleaned = reason?.trim() ?? "";
            if (cleaned.length < 8) throw new Error("Enter a reason with at least 8 characters.");
            setBusy(true);
            try {
              const result = await runMutation<OperationAccepted, SecretReasonBody>(
                operationMutations.restart(cleaned),
              );
              setSelectedOperationId(result.data.operation_id);
              setConfirmRestart(false);
              await queryClient.invalidateQueries({ queryKey: ["ops", "runtime"] });
              await queryClient.invalidateQueries({ queryKey: ["deploy", "history"] });
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

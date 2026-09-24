import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { operationMutations } from "@/lib/admin/api";
import type { DeploymentOperation } from "@/lib/admin/types";
import { DeployPage, ConfigurationPage, RuntimePage, SecretFilesPage } from "./deployment-pages";

const mockState = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/components/auth/session-context", () => ({ useAdminSession: () => mockState.session }));

const currentSha = "a".repeat(40);
const candidateSha = "b".repeat(40);
type TestOperation = Omit<DeploymentOperation, "kind" | "resulting_active_revision"> & {
  kind: DeploymentOperation["kind"];
  resulting_active_revision: string | null;
};

const operation: TestOperation = {
  id: "dpl_test",
  kind: "DEPLOY" as const,
  state: "BUILDING",
  current_step: "BUILDING",
  candidate_sha: candidateSha,
  previous_commit: currentSha,
  resulting_active_revision: null,
  requested_at: "2026-09-24T10:00:00.000Z",
  started_at: "2026-09-24T10:00:01.000Z",
  requested_by: "adm_test",
  reason: "Fixture deployment reason",
  safe_error: null,
  rollback_state: null,
  steps: { FETCHING: "2026-09-24T10:00:01.000Z", BUILDING: "2026-09-24T10:00:02.000Z" },
};

let mutation: ReturnType<typeof vi.fn>;
let client: QueryClient;

function setup(
  options: {
    activeOperation?: TestOperation | null;
    currentOperation?: TestOperation;
    ahead?: number;
    configValue?: string;
  } = {},
) {
  const activeOperation = options.activeOperation ?? null;
  const currentOperation = options.currentOperation ?? operation;
  mutation = vi.fn(async (input: { path: string; body?: unknown }) => {
    if (input.path === "/system/config/validate")
      return { data: { valid: true, issues: [] }, request_id: "req_test" };
    if (input.path === "/system/config")
      return {
        data: {
          saved_revision: "d".repeat(64),
          running_revision: "c".repeat(64),
          restart_required: true,
        },
        request_id: "req_test",
      };
    if (input.path.endsWith(":reveal"))
      return {
        data: { name: "database-password", value: "secret-value-that-is-not-cached" },
        request_id: "req_test",
      };
    return { data: { operation_id: "dpl_test", state: "QUEUED" }, request_id: "req_test" };
  });
  const api = {
    operations: {
      status: vi.fn(async () => ({
        data: {
          active: {
            release_id: "dpl_current",
            commit_sha: currentSha,
            built_at: "2026-09-23T10:00:00.000Z",
            branch: "main",
          },
          pm2: { status: "online", pid: 12, uptime_ms: 20_000 },
          readiness: "ready",
          serving_commit: currentSha,
          revision_matches_active: true,
          active_operation: activeOperation,
        },
        request_id: "req_test",
      })),
      runtime: vi.fn(async () => ({
        data: {
          active: {
            release_id: "dpl_current",
            commit_sha: currentSha,
            built_at: "2026-09-23T10:00:00.000Z",
            branch: "main",
          },
          pm2: { status: "online", pid: 12, uptime_ms: 20_000 },
          readiness: "ready",
          serving_commit: currentSha,
          revision_matches_active: true,
          active_operation: null,
        },
        request_id: "req_test",
      })),
      remote: vi.fn(async () => ({
        data: {
          current: {
            release_id: "dpl_current",
            commit_sha: currentSha,
            built_at: "2026-09-23T10:00:00.000Z",
            branch: "main",
          },
          candidate_sha: candidateSha,
          candidate_title: "Candidate change",
          branch: "main",
          ahead: options.ahead ?? 1,
          diverged: false,
          commits: [
            {
              sha: candidateSha,
              title: "Candidate change",
              author: "Operator",
              committed_at: "2026-09-24T10:00:00.000Z",
            },
          ],
          checked_at: "2026-09-24T10:00:00.000Z",
        },
        request_id: "req_test",
      })),
      history: vi.fn(async () => ({ data: { deployments: [operation] }, request_id: "req_test" })),
      detail: vi.fn(async () => ({ data: currentOperation, request_id: "req_test" })),
      logs: vi.fn(async (_id: string, after: number) => ({
        data: {
          lines:
            after === 0
              ? [
                  {
                    at: "2026-09-24T10:00:03.000Z",
                    phase: "BUILDING",
                    stream: "stdout",
                    text: "Build output",
                  },
                ]
              : [],
          next_offset: after === 0 ? 10 : after,
        },
        request_id: "req_test",
      })),
      config: vi.fn(async () => ({
        data: {
          entries: [
            {
              key: "LOG_LEVEL",
              value: options.configValue ?? "info",
              editable: true,
              masked: false,
            },
            { key: "DUNESBIT_PROJECT_API_KEY", value: null, editable: false, masked: true },
          ],
          editable_keys: ["LOG_LEVEL", "HOST"],
          saved_revision: "c".repeat(64),
          running_revision: "c".repeat(64),
          restart_required: false,
        },
        request_id: "req_test",
      })),
      secrets: vi.fn(async () => ({
        data: {
          secrets: [
            { name: "database-password", updated_at: "2026-09-24T10:00:00.000Z", size_bytes: 24 },
          ],
        },
        request_id: "req_test",
      })),
    },
  };
  mockState.session = {
    status: "authenticated",
    admin: {
      id: "adm_test",
      email: "operator@example.test",
      roles: ["ROOT"],
      permissions: ["*"],
      assignable_roles: ["ROOT"],
      mfa_enabled: true,
      mfa_satisfied: true,
      session_id: "ase_test",
    },
    api,
    runMutation: mutation,
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

function renderPage(page: ReactNode) {
  return render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
}

beforeEach(() => setup());
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});

describe("operator deployment and runtime pages", () => {
  it("requires confirmation, sends the typed exact-SHA request, and resumes progress/logs", async () => {
    const user = userEvent.setup();
    renderPage(<DeployPage />);
    await expect(screen.findByRole("heading", { name: "Deploy Havenerr" })).resolves.toBeVisible();
    await user.click(screen.getByRole("button", { name: `Deploy ${candidateSha.slice(0, 12)}` }));
    const dialog = screen.getByRole("dialog", { name: "Deploy reviewed commit" });
    await user.type(within(dialog).getByLabelText("Reason"), "Deploy reviewed candidate");
    await user.click(
      within(dialog).getByRole("button", { name: `Deploy ${candidateSha.slice(0, 12)}` }),
    );
    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith(
        operationMutations.deploy({
          candidate_sha: candidateSha,
          reason: "Deploy reviewed candidate",
        }),
      ),
    );
    expect(await screen.findByRole("heading", { name: "Operation dpl_test" })).toBeVisible();
    expect(await screen.findByText(/Build output/)).toBeVisible();
  });

  it("shows up-to-date production without enabling deployment", async () => {
    setup({ ahead: 0 });
    renderPage(<DeployPage />);
    await expect(screen.findByText("Production is up to date.")).resolves.toBeVisible();
    expect(
      screen.getByRole("button", { name: `Deploy ${candidateSha.slice(0, 12)}` }),
    ).toBeDisabled();
  });

  it("validates and saves only typed allowlisted configuration changes", async () => {
    const user = userEvent.setup();
    renderPage(<ConfigurationPage />);
    const level = await screen.findByLabelText("LOG_LEVEL");
    expect(screen.getByText("Masked")).toBeVisible();
    expect(screen.queryByText("db_live_fixture_secret")).toBeNull();
    await user.clear(level);
    await user.type(level, "debug");
    await user.click(screen.getByRole("button", { name: "Validate candidate" }));
    await expect(
      screen.findByText("Candidate configuration passed validation."),
    ).resolves.toBeVisible();
    await user.type(screen.getByLabelText("Save reason"), "Reduce production log volume");
    await user.click(screen.getByRole("button", { name: "Save configuration" }));
    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/system/config",
          method: "PUT",
          body: expect.objectContaining({
            changes: [{ key: "LOG_LEVEL", value: "debug" }],
            expected_revision: "c".repeat(64),
          }),
        }),
      ),
    );
  });

  it("keeps secret values hidden until one-time reveal and clears them on request", async () => {
    const user = userEvent.setup();
    renderPage(<SecretFilesPage />);
    await expect(screen.findByText("database-password")).resolves.toBeVisible();
    expect(screen.queryByText("secret-value-that-is-not-cached")).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Reveal once" })[0]!);
    await user.type(screen.getByLabelText("Reason"), "Inspect credential after rotation");
    await user.click(screen.getAllByRole("button", { name: "Reveal once" }).at(-1)!);
    await expect(screen.findByText("secret-value-that-is-not-cached")).resolves.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Hide now" }));
    expect(screen.queryByText("secret-value-that-is-not-cached")).toBeNull();
    expect(mutation).toHaveBeenCalledWith(
      operationMutations.revealSecret("database-password", {
        reason: "Inspect credential after rotation",
      }),
    );
  });

  it("requires a safe-redaction minimum before creating a managed secret", async () => {
    const user = userEvent.setup();
    renderPage(<SecretFilesPage />);
    await expect(screen.findByText("database-password")).resolves.toBeVisible();
    await user.type(screen.getByLabelText("Filename"), "temporary-secret");
    await user.type(screen.getByLabelText("Secret value"), "abc");
    await user.type(screen.getByLabelText("Creation reason"), "Create a temporary test credential");
    const submit = screen.getByRole("button", { name: "Create secret file" });
    expect(submit).toBeDisabled();
    expect(mutation).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Secret value"), "d");
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith(
        operationMutations.createSecret({
          name: "temporary-secret",
          value: "abcd",
          reason: "Create a temporary test credential",
        }),
      ),
    );
  });

  it("queues a restart through the session step-up path and requires healthy runtime data", async () => {
    const user = userEvent.setup();
    setup({
      currentOperation: {
        ...operation,
        kind: "RESTART",
        state: "SUCCEEDED",
        current_step: "SUCCEEDED",
        resulting_active_revision: currentSha,
      },
    });
    renderPage(<RuntimePage />);
    await expect(
      screen.findByRole("heading", { name: "Runtime and restart" }),
    ).resolves.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Restart backend" }));
    const dialog = screen.getByRole("dialog", { name: "Restart Havenerr backend" });
    await user.type(within(dialog).getByLabelText("Reason"), "Apply reviewed runtime settings");
    await user.click(within(dialog).getByRole("button", { name: "Queue restart" }));
    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith(
        operationMutations.restart("Apply reviewed runtime settings"),
      ),
    );
    await expect(
      screen.findByText(/Restart completed\. Readiness is restored/),
    ).resolves.toBeVisible();
  });
});

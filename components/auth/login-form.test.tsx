import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const signIn = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/auth/session-context", () => ({
  useAdminSession: () => ({ status: "unauthenticated", admin: null, signIn }),
}));

import LoginPage from "@/app/(auth)/login/page";

describe("admin login screen", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    replace.mockReset();
    signIn.mockReset();
    signIn.mockResolvedValue({ mfa_enrollment_required: false });
  });

  it("submits email and password without accepting customer credentials", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Admin email"), {
      target: { value: "operator@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "a-long-admin-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        email: "operator@example.com",
        password: "a-long-admin-password",
      }),
    );
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("moves to the MFA code fields after the server requires MFA", async () => {
    const { AdminApiError } = await import("@/lib/admin/errors");
    signIn.mockRejectedValueOnce(new AdminApiError({ code: "ADMIN_MFA_REQUIRED", status: 401 }));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Admin email"), {
      target: { value: "operator@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "a-long-admin-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByLabelText("MFA code")).toBeInTheDocument());
    expect(screen.getByLabelText("Recovery code")).toBeInTheDocument();
  });
});

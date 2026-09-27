import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replace, runMutation, refreshMe, toDataURL } = vi.hoisted(() => ({
  replace: vi.fn(),
  runMutation: vi.fn(),
  refreshMe: vi.fn(),
  toDataURL: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/components/auth/session-context", () => ({
  useAdminSession: () => ({ status: "authenticated", runMutation, refreshMe }),
}));
vi.mock("qrcode", () => ({ default: { toDataURL } }));

import MfaEnrollPage from "@/app/(auth)/mfa/enroll/page";

const setupUri =
  "otpauth://totp/Havenerr%3Aoperator%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Havenerr";

describe("admin MFA enrollment", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    replace.mockReset();
    refreshMe.mockReset().mockResolvedValue(null);
    toDataURL.mockReset().mockResolvedValue("data:image/png;base64,local-qr");
    runMutation.mockReset().mockImplementation(async ({ path }: { path: string }) => {
      if (path === "/auth/mfa/enroll") {
        return { data: { secret: "JBSWY3DPEHPK3PXP", otpauth_uri: setupUri } };
      }
      if (path === "/auth/mfa/confirm") {
        return { data: { recovery_codes: ["ABCD-EFGH"] } };
      }
      throw new Error(`Unexpected mutation: ${path}`);
    });
  });

  it("renders a QR from the API URI and confirms enrollment with the entered TOTP code", async () => {
    render(<MfaEnrollPage />);

    const qr = await screen.findByRole("img", { name: "Authenticator setup QR code" });
    expect(qr).toHaveAttribute("src", "data:image/png;base64,local-qr");
    expect(toDataURL).toHaveBeenCalledWith(
      setupUri,
      expect.objectContaining({ errorCorrectionLevel: "M", width: 240 }),
    );
    expect(runMutation).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/auth/mfa/enroll", body: {} }),
    );

    fireEvent.change(screen.getByLabelText("Confirmation code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm MFA" }));

    await waitFor(() =>
      expect(runMutation).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/auth/mfa/confirm", body: { code: "123456" } }),
      ),
    );
    expect(await screen.findByText("Save your recovery codes")).toBeInTheDocument();
    expect(screen.getByText("ABCD-EFGH")).toBeInTheDocument();
    expect(refreshMe).toHaveBeenCalledOnce();
  });

  it("keeps manual setup available if local QR generation fails", async () => {
    toDataURL.mockRejectedValueOnce(new Error("canvas unavailable"));
    render(<MfaEnrollPage />);

    expect(
      await screen.findByText("Enter the setup key above manually in your authenticator app."),
    ).toBeInTheDocument();
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmation code")).toBeEnabled();
  });
});

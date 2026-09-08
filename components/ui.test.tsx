import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, DataTable, Modal } from "./ui";

afterEach(() => cleanup());

describe("accessible shared UI", () => {
  it("traps modal focus, closes on Escape, and restores the opener", () => {
    const opener = document.createElement("button");
    opener.type = "button";
    opener.textContent = "Open";
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const view = render(
      <Modal title="Confirm action" description="Review the target." onClose={onClose}>
        <Button type="button">Confirm</Button>
      </Modal>,
    );

    const close = screen.getByRole("button", { name: "Close dialog" });
    expect(document.activeElement).toBe(close);
    screen.getByRole("button", { name: "Confirm" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();

    view.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("makes narrow tables keyboard-scrollable and names their region", () => {
    render(
      <DataTable
        caption="Customer users"
        rows={[{ id: "usr_1" }]}
        rowKey={(row) => row.id}
        columns={[{ key: "id", label: "ID", render: (row) => row.id }]}
      />,
    );
    const region = screen.getByRole("region", {
      name: "Customer users table. Use horizontal scrolling on narrow screens.",
    });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table", { name: "Customer users" })).toBeInTheDocument();
  });
});

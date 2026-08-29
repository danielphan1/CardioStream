import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateRangePicker } from "./DateRangePicker";

describe("DateRangePicker", () => {
  it("fades in from opacity-0 to opacity-100 on mount", async () => {
    const { container } = render(
      <DateRangePicker from={null} to={null} onApply={vi.fn()} />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/opacity-0/);
    expect(root.className).toMatch(/transition-opacity/);

    await waitFor(() => expect(root.className).toMatch(/opacity-100/));
  });

  it("locks the transition classes on the root element", () => {
    const { container } = render(
      <DateRangePicker from={null} to={null} onApply={vi.fn()} />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/transition-opacity/);
    expect(root.className).toMatch(/duration-\[250ms\]/);
    expect(root.className).toMatch(/ease-in-out/);
    expect(root.className).toMatch(/motion-reduce:transition-none/);
  });

  it("renders the From/To inputs and a disabled Apply button when empty", () => {
    render(<DateRangePicker from={null} to={null} onApply={vi.fn()} />);

    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    const applyButton = screen.getByRole("button", { name: "Apply" });
    expect(applyButton).toBeInTheDocument();
    expect(applyButton).toHaveAttribute("aria-disabled", "true");
  });
});

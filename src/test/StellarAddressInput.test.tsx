import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StellarAddressInput } from "@/components/StellarAddressInput";

const VALID_ADDRESS = "GA7FYRB5V3AP6P2RROT2P6KRSZ3K6QI6W3Y6KX2X7HX6Q5Y6KX2X7HX6";
const CONNECTED_ADDRESS = "GCXKG6RN4ON6MJG5VQZ2KQ3X4Y5P6Q7R8A9B0C1D2E3F4G5H6I7J8K9L0M";
const SHORT_ADDRESS = "GBBB";
const INVALID_CHAR_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("StellarAddressInput", () => {
  it("renders with default label and placeholder", () => {
    render(<StellarAddressInput value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Recipient Stellar Address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("G...")).toBeInTheDocument();
  });

  it("accepts a custom label via props", () => {
    render(<StellarAddressInput value="" onChange={() => {}} label="Custom Label" />);
    expect(screen.getByLabelText("Custom Label")).toBeInTheDocument();
  });

  it("calls onChange with valid result when a valid address is entered", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<StellarAddressInput value="" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await user.type(input, VALID_ADDRESS);

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(VALID_ADDRESS.slice(-1));
    expect(lastCall[1]).toEqual({ status: "valid" });
  });

  it("shows invalid format error for a short address", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<StellarAddressInput value="" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await user.type(input, SHORT_ADDRESS);

    expect(screen.getByText("Invalid Stellar address format")).toBeInTheDocument();
  });

  it("shows self-address warning when address matches connected wallet", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <StellarAddressInput
        value=""
        onChange={onChange}
        connectedAddress={CONNECTED_ADDRESS}
      />,
    );
    const input = screen.getByRole("textbox");
    await user.type(input, CONNECTED_ADDRESS);

    expect(screen.getByText("Cannot use your own wallet address")).toBeInTheDocument();
  });

  it("shows a green check icon when the address is valid", async () => {
    const user = userEvent.setup();

    render(<StellarAddressInput value="" onChange={() => {}} />);
    const input = screen.getByRole("textbox");
    await user.type(input, VALID_ADDRESS);

    const checkIcon = document.querySelector(".text-emerald-400");
    expect(checkIcon).toBeInTheDocument();
  });

  it("marks input as aria-invalid when address is invalid", async () => {
    const user = userEvent.setup();

    render(<StellarAddressInput value="" onChange={() => {}} />);
    const input = screen.getByRole("textbox");
    await user.type(input, SHORT_ADDRESS);

    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("does not show aria-invalid for empty input", () => {
    render(<StellarAddressInput value="" onChange={() => {}} />);
    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("does not show error message for empty input", () => {
    render(<StellarAddressInput value="" onChange={() => {}} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables the input when disabled prop is true", () => {
    render(<StellarAddressInput value="" onChange={() => {}} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("applies custom className to the wrapper", () => {
    const { container } = render(
      <StellarAddressInput value="" onChange={() => {}} className="my-custom-class" />,
    );
    expect(container.firstChild).toHaveClass("my-custom-class");
  });

  it("uses the provided id for the input element", () => {
    render(<StellarAddressInput value="" onChange={() => {}} id="my-address-input" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("id", "my-address-input");
  });

  it("clears error when input is cleared", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(<StellarAddressInput value="" onChange={onChange} />);
    const input = screen.getByRole("textbox");

    await user.type(input, SHORT_ADDRESS);
    expect(screen.getByText("Invalid Stellar address format")).toBeInTheDocument();

    await user.clear(input);

    rerender(<StellarAddressInput value="" onChange={onChange} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

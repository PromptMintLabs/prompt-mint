import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PushPermissionPrompt } from "../components/notifications/PushPermissionPrompt";
import * as pushModule from "../lib/notifications/push";

describe("PushPermissionPrompt Component (#750)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders prompt when permission is default and not dismissed", () => {
    vi.spyOn(pushModule, "isPushSupported").mockReturnValue(true);
    vi.spyOn(pushModule, "getPushPermissionStatus").mockReturnValue("default");

    render(<PushPermissionPrompt />);

    expect(screen.getByTestId("push-permission-prompt")).toBeInTheDocument();
    expect(screen.getByText("Stay Updated with Real-Time Alerts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable Notifications" })).toBeInTheDocument();
  });

  it("does not render when push is unsupported", () => {
    vi.spyOn(pushModule, "isPushSupported").mockReturnValue(false);

    const { container } = render(<PushPermissionPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when permission is already granted", () => {
    vi.spyOn(pushModule, "isPushSupported").mockReturnValue(true);
    vi.spyOn(pushModule, "getPushPermissionStatus").mockReturnValue("granted");

    const { container } = render(<PushPermissionPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders blocked banner when permission is denied", () => {
    vi.spyOn(pushModule, "isPushSupported").mockReturnValue(true);
    vi.spyOn(pushModule, "getPushPermissionStatus").mockReturnValue("denied");

    render(<PushPermissionPrompt />);

    expect(screen.getByText(/Push notifications are blocked/)).toBeInTheDocument();
  });

  it("calls requestPushPermission and triggers onPermissionGranted on grant", async () => {
    vi.spyOn(pushModule, "isPushSupported").mockReturnValue(true);
    vi.spyOn(pushModule, "getPushPermissionStatus").mockReturnValue("default");
    vi.spyOn(pushModule, "requestPushPermission").mockResolvedValue("granted");

    const onGranted = vi.fn();
    render(<PushPermissionPrompt onPermissionGranted={onGranted} />);

    const enableBtn = screen.getByRole("button", { name: "Enable Notifications" });
    await fireEvent.click(enableBtn);

    expect(onGranted).toHaveBeenCalledTimes(1);
  });


  it("dismisses prompt and persists preference on Maybe Later click", () => {
    vi.spyOn(pushModule, "isPushSupported").mockReturnValue(true);
    vi.spyOn(pushModule, "getPushPermissionStatus").mockReturnValue("default");

    const onDismiss = vi.fn();
    render(<PushPermissionPrompt onDismiss={onDismiss} storageKey="test_dismiss" />);

    const laterBtn = screen.getByRole("button", { name: "Maybe Later" });
    fireEvent.click(laterBtn);

    expect(localStorage.getItem("test_dismiss")).toBe("true");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

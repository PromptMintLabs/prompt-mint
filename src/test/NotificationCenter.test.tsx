import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@stellar/design-system", () => ({
  Notification: ({ title }: { title: string }) => <div data-testid="stellar-notification">{title}</div>,
}));

import { NotificationProvider } from "../providers/NotificationProvider";
import { useNotification } from "../hooks/useNotification";
import { NotificationCenter } from "../components/NotificationCenter";

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

const HelperTrigger: React.FC = () => {
  const { addNotification } = useNotification();
  return (
    <button
      type="button"
      onClick={() => addNotification("New purchase event", "success", "Sale Alert")}
    >
      Trigger Notification
    </button>
  );
};

describe("NotificationCenter Component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders bell icon button", () => {
    render(
      <TestWrapper>
        <NotificationCenter />
      </TestWrapper>
    );

    expect(screen.getByRole("button", { name: "Notification Center" })).toBeInTheDocument();
  });

  it("opens dropdown panel on click and lists notifications", () => {
    render(
      <TestWrapper>
        <NotificationCenter />
      </TestWrapper>
    );

    const bellBtn = screen.getByRole("button", { name: "Notification Center" });
    fireEvent.click(bellBtn);

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Welcome to Prompt Mint")).toBeInTheDocument();
  });

  it("adds new notification and increments unread badge count", () => {
    render(
      <TestWrapper>
        <HelperTrigger />
        <NotificationCenter />
      </TestWrapper>
    );

    const triggerBtn = screen.getByRole("button", { name: "Trigger Notification" });
    fireEvent.click(triggerBtn);

    const bellBtn = screen.getByRole("button", { name: "Notification Center" });
    fireEvent.click(bellBtn);

    expect(screen.getByText("New purchase event")).toBeInTheDocument();
  });

  it("marks all notifications as read when Read all is clicked", () => {
    render(
      <TestWrapper>
        <HelperTrigger />
        <NotificationCenter />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: "Trigger Notification" }));
    fireEvent.click(screen.getByRole("button", { name: "Notification Center" }));

    const readAllBtn = screen.getByRole("button", { name: "Read all" });
    fireEvent.click(readAllBtn);

    expect(screen.getByText("Unread (0)")).toBeInTheDocument();
  });

  it("renders click tracking link and tracks click when clicked (#749)", () => {
    const LinkTrigger: React.FC = () => {
      const { addNotification } = useNotification();
      return (
        <button
          type="button"
          onClick={() =>
            addNotification(
              "Your prompt was purchased",
              "success",
              "New Sale",
              "https://promptmint.io/prompts/123",
              "View Prompt",
            )
          }
        >
          Add With Link
        </button>
      );
    };

    render(
      <TestWrapper>
        <LinkTrigger />
        <NotificationCenter />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add With Link" }));
    fireEvent.click(screen.getByRole("button", { name: "Notification Center" }));

    const link = screen.getByRole("link", { name: "View Prompt" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://promptmint.io/prompts/123");

    fireEvent.click(link);
    // Welcome notification is still unread, so unread count decrements to 1
    expect(screen.getByText("Unread (1)")).toBeInTheDocument();
  });
});



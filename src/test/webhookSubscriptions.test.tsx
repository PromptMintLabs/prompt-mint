/**
 * Tests for the webhook subscriptions console (issue #753).
 *
 * Cover the success paths (reading, registering, updating, deleting an
 * endpoint) and the edge cases (no wallet connected, no endpoint registered,
 * both API response envelopes, invalid URLs, failed requests).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./render";
import WebhookSubscriptions, {
  AVAILABLE_EVENTS,
  isValidEndpoint,
  normaliseSubscriptions,
} from "../components/webhooks/WebhookSubscriptions";

const WALLET = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV";
const ENDPOINT = "https://hooks.example.com/prompt-mint";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const subscription = {
  _id: "sub_1",
  url: ENDPOINT,
  events: ["PromptPurchased"],
  active: true,
  failureCount: 0,
  lastDeliveredAt: "2026-09-20T10:00:00.000Z",
  updatedAt: "2026-09-20T10:00:00.000Z",
};

function mockFetchSequence(...responses: Response[]) {
  const fn = vi.fn();
  for (const response of responses) fn.mockResolvedValueOnce(response);
  // Any unexpected extra call resolves to an empty 404 console.
  fn.mockResolvedValue(jsonResponse({ error: "No webhook registered for this wallet." }, 404));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const calls = () => (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;

const bodyOf = (init: unknown) =>
  JSON.parse((init as { body: string }).body) as Record<string, unknown>;

describe("webhook subscription helpers", () => {
  it("accepts only http(s) endpoint URLs", () => {
    expect(isValidEndpoint("https://hooks.example.com/x")).toBe(true);
    expect(isValidEndpoint("http://localhost:4000/hooks")).toBe(true);
    expect(isValidEndpoint("ftp://hooks.example.com")).toBe(false);
    expect(isValidEndpoint("/relative/hooks")).toBe(false);
    expect(isValidEndpoint("not a url")).toBe(false);
  });

  it("normalises both API envelopes into a list", () => {
    expect(normaliseSubscriptions({ webhook: subscription })).toHaveLength(1);
    expect(normaliseSubscriptions(subscription)).toHaveLength(1);
    expect(normaliseSubscriptions([subscription])).toHaveLength(1);
    expect(normaliseSubscriptions({ apiVersion: "2025-01-01" })).toEqual([]);
    expect(normaliseSubscriptions(null)).toEqual([]);
  });

  it("offers the contract events the controller accepts", () => {
    const names = AVAILABLE_EVENTS.map((event) => event.name);
    expect(names).toContain("PromptPurchased");
    expect(names).toContain("DisputeOpened");
    expect(names).toContain("LicenseTransferred");
  });
});

describe("WebhookSubscriptions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks the visitor to connect a wallet without making a request", () => {
    const fetchMock = mockFetchSequence();
    renderWithProviders(<WebhookSubscriptions />);

    expect(
      screen.getByText("Connect a wallet to manage webhook subscriptions"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists the endpoint registered for the connected wallet", async () => {
    mockFetchSequence(jsonResponse({ apiVersion: "2025-01-01", webhook: subscription }));
    renderWithProviders(<WebhookSubscriptions />, {
      wallet: { address: WALLET, status: "connected" },
    });

    await waitFor(() => expect(screen.getByText(ENDPOINT)).toBeInTheDocument());
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(calls()[0][0]).toBe(`/api/webhooks?walletAddress=${encodeURIComponent(WALLET)}`);
  });

  it("renders the empty console when the wallet has no endpoint (404)", async () => {
    mockFetchSequence(
      jsonResponse({ error: "No webhook registered for this wallet." }, 404),
    );
    renderWithProviders(<WebhookSubscriptions />, {
      wallet: { address: WALLET, status: "connected" },
    });

    await waitFor(() =>
      expect(screen.getByText("No subscription endpoints")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /Register subscription/ }),
    ).toBeInTheDocument();
  });

  it("registers a new endpoint and reveals the one-time secret", async () => {
    mockFetchSequence(
      jsonResponse({ error: "No webhook registered for this wallet." }, 404),
      jsonResponse({ message: "Webhook registered.", id: "sub_2", secret: "s3cret" }, 201),
      jsonResponse({ error: "No webhook registered for this wallet." }, 404),
    );
    renderWithProviders(<WebhookSubscriptions />, {
      wallet: { address: WALLET, status: "connected" },
    });

    await waitFor(() =>
      expect(screen.getByText("No subscription endpoints")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Endpoint URL"), {
      target: { value: ENDPOINT },
    });
    fireEvent.click(screen.getByRole("button", { name: /Register subscription/ }));

    await waitFor(() => expect(screen.getByText("s3cret")).toBeInTheDocument());
    expect(screen.getByText(/it will not be shown again/)).toBeInTheDocument();

    const post = calls().find(([, init]) => (init as { method?: string }).method === "POST");
    expect(post?.[0]).toBe("/api/webhooks");
    expect(bodyOf(post?.[1])).toEqual({
      walletAddress: WALLET,
      url: ENDPOINT,
      events: ["PromptPurchased"],
    });
  });

  it("sends the selected events when updating", async () => {
    mockFetchSequence(
      jsonResponse(subscription),
      jsonResponse({ message: "Webhook updated.", id: "sub_1", secret: "rotated" }, 200),
      jsonResponse(subscription),
    );
    renderWithProviders(<WebhookSubscriptions />, {
      wallet: { address: WALLET, status: "connected" },
    });

    await waitFor(() => expect(screen.getByText(ENDPOINT)).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/LicenseTransferred/));
    fireEvent.click(screen.getByRole("button", { name: /Update subscription/ }));

    await waitFor(() =>
      expect(
        calls().some(([, init]) => (init as { method?: string }).method === "POST"),
      ).toBe(true),
    );

    const post = calls().find(([, init]) => (init as { method?: string }).method === "POST");
    expect(bodyOf(post?.[1]).events).toEqual(["PromptPurchased", "LicenseTransferred"]);
  });

  it("deletes the wallet's endpoint", async () => {
    mockFetchSequence(
      jsonResponse(subscription),
      jsonResponse({ message: "Webhook removed." }),
      jsonResponse({ error: "No webhook registered for this wallet." }, 404),
    );
    renderWithProviders(<WebhookSubscriptions />, {
      wallet: { address: WALLET, status: "connected" },
    });

    await waitFor(() => expect(screen.getByText(ENDPOINT)).toBeInTheDocument());
    fireEvent.click(
      screen.getByRole("button", { name: `Delete subscription ${ENDPOINT}` }),
    );

    await waitFor(() => expect(screen.getByText("Subscription removed.")).toBeInTheDocument());
    const del = calls().find(([, init]) => (init as { method?: string }).method === "DELETE");
    expect(del?.[0]).toBe("/api/webhooks");
    expect(bodyOf(del?.[1])).toEqual({ walletAddress: WALLET });
  });

  it("blocks submission for an invalid endpoint and surfaces API errors", async () => {
    mockFetchSequence(
      jsonResponse({ error: "No webhook registered for this wallet." }, 404),
      jsonResponse({ error: "url must be a valid URL." }, 400),
      jsonResponse({ error: "No webhook registered for this wallet." }, 404),
    );
    renderWithProviders(<WebhookSubscriptions />, {
      wallet: { address: WALLET, status: "connected" },
    });

    await waitFor(() =>
      expect(screen.getByText("No subscription endpoints")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Endpoint URL"), {
      target: { value: "not-a-url" },
    });
    expect(screen.getByText("Enter a valid http(s) URL.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Register subscription/ }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Endpoint URL"), {
      target: { value: ENDPOINT },
    });
    fireEvent.click(screen.getByRole("button", { name: /Register subscription/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("url must be a valid URL."),
    );
  });
});

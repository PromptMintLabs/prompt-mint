import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CurrencyProvider, useCurrency } from "@/providers/CurrencyProvider";

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  public readyState = 0;
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.(new Event("open"));
    });
  }

  send() {}

  close() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close"));
  }

  emitRate(rate: number) {
    this.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({ stellar: rate.toString() }),
      }),
    );
  }
}

function Consumer() {
  const { currency, xlmUsdRate, priceConnectionStatus } = useCurrency();

  return (
    <div>
      <span>{currency}</span>
      <span>{xlmUsdRate ? `$${xlmUsdRate.toFixed(2)}` : "no-rate"}</span>
      <span>{priceConnectionStatus}</span>
    </div>
  );
}

describe("CurrencyProvider", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  });

  it("connects to the live price socket and updates the displayed rate without a refresh", async () => {
    render(
      <CurrencyProvider>
        <Consumer />
      </CurrencyProvider>,
    );

    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("connecting")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("live")).toBeInTheDocument();
    });

    const socket = MockWebSocket.instances[0];
    socket.emitRate(0.42);

    await waitFor(() => {
      expect(screen.getByText("$0.42")).toBeInTheDocument();
    });
  });
});

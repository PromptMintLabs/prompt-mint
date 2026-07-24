import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import React from "react";
import { browserStellarConfig } from "../lib/stellar/browserConfig";

export type ServiceHealthStatus = "up" | "degraded" | "down";

export interface NetworkState {
  isOnline: boolean;
  rpcStatus: ServiceHealthStatus;
  horizonStatus: ServiceHealthStatus;
  unlockStatus: ServiceHealthStatus;
  isDegraded: boolean;
  isDown: boolean;
  canTrustConfirmation: boolean;
  lastCheckedAt: Date | null;
  statusMessage: string;
  checkHealth: () => Promise<void>;
}

const defaultState: NetworkState = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  rpcStatus: "up",
  horizonStatus: "up",
  unlockStatus: "up",
  isDegraded: false,
  isDown: false,
  canTrustConfirmation: true,
  lastCheckedAt: new Date(),
  statusMessage: "All systems operational",
  checkHealth: async () => {},
};

export const NetworkStateContext = createContext<NetworkState>(defaultState);

async function checkUrlHealth(url: string, timeoutMs = 5000): Promise<ServiceHealthStatus> {
  if (!url) return "up";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal }).catch(async () => {
      // Fallback to GET if HEAD fails
      return await fetch(url, { method: "GET", signal: controller.signal });
    });
    clearTimeout(timer);
    return res.ok ? "up" : "degraded";
  } catch {
    return "down";
  }
}

export function NetworkStateProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [rpcStatus, setRpcStatus] = useState<ServiceHealthStatus>("up");
  const [horizonStatus, setHorizonStatus] = useState<ServiceHealthStatus>("up");
  const [unlockStatus, setUnlockStatus] = useState<ServiceHealthStatus>("up");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(new Date());

  const checkHealth = useCallback(async () => {
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    setIsOnline(online);

    if (!online) {
      setRpcStatus("down");
      setHorizonStatus("down");
      setUnlockStatus("down");
      setLastCheckedAt(new Date());
      return;
    }

    try {
      const [rpc, horizon, unlock] = await Promise.all([
        browserStellarConfig.rpcUrl
          ? checkUrlHealth(browserStellarConfig.rpcUrl)
          : Promise.resolve<ServiceHealthStatus>("up"),
        browserStellarConfig.horizonUrl
          ? checkUrlHealth(browserStellarConfig.horizonUrl)
          : Promise.resolve<ServiceHealthStatus>("up"),
        checkUrlHealth("/api/health"),
      ]);

      setRpcStatus(rpc);
      setHorizonStatus(horizon);
      setUnlockStatus(unlock);
    } catch {
      setRpcStatus("degraded");
    } finally {
      setLastCheckedAt(new Date());
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void checkHealth();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setRpcStatus("down");
      setHorizonStatus("down");
      setUnlockStatus("down");
      setLastCheckedAt(new Date());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    void checkHealth();

    // Poll health every 30 seconds
    const interval = setInterval(() => void checkHealth(), 30_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkHealth]);

  const isDegraded =
    !isOnline || rpcStatus === "degraded" || horizonStatus === "degraded" || unlockStatus === "degraded";

  const isDown = !isOnline || rpcStatus === "down" || horizonStatus === "down";

  const canTrustConfirmation = isOnline && !isDown;

  let statusMessage = "All systems operational";
  if (!isOnline) {
    statusMessage = "Offline — Network connection lost. Read-only mode enabled.";
  } else if (isDown) {
    statusMessage = "Stellar Network unavailable. Transactions disabled.";
  } else if (isDegraded) {
    statusMessage = "Degraded connection detected. Confirmation delays may occur.";
  }

  const value: NetworkState = {
    isOnline,
    rpcStatus,
    horizonStatus,
    unlockStatus,
    isDegraded,
    isDown,
    canTrustConfirmation,
    lastCheckedAt,
    statusMessage,
    checkHealth,
  };

  return (
    <NetworkStateContext.Provider value={value}>
      {children}
    </NetworkStateContext.Provider>
  );
}

export function useNetworkState() {
  return useContext(NetworkStateContext);
}

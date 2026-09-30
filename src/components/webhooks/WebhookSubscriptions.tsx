/**
 * WebhookSubscriptions — the subscription console for the webhook management
 * page.
 *
 * Shows the endpoint(s) registered for the connected wallet and lets the
 * creator register, update, and delete them. It reads and writes the existing
 * wallet-scoped API:
 *
 *   GET    /api/webhooks?walletAddress=...
 *   POST   /api/webhooks  { walletAddress, url, events }
 *   DELETE /api/webhooks  { walletAddress }
 *
 * This complements `src/components/WebhookSettings.tsx` (the single-endpoint
 * card used on the profile page) by presenting the same endpoints in the
 * tabular console style used by the other webhook tabs. It does not re-implement
 * that widget's logic: every mutation goes through the shared HTTP surface and
 * the table is re-read from `GET` afterwards, so what is displayed is what the
 * server actually stored.
 */
import { useCallback, useEffect, useState } from "react";
import { Globe, Loader2, PlugZap, RefreshCw, Save, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/hooks/useWallet";
import { shortenAddress } from "@/lib/utils";

export interface WebhookSubscription {
  _id: string;
  url: string;
  events: string[];
  active: boolean;
  failureCount?: number;
  lastDeliveredAt?: string | null;
  updatedAt?: string;
}

/**
 * Contract events the backing controller accepts
 * (`ALLOWED_EVENTS` in server/src/controllers/webhookControllers.ts). Events
 * outside this list are silently dropped by the API, so the picker only offers
 * these.
 */
export const AVAILABLE_EVENTS: ReadonlyArray<{ name: string; description: string }> = [
  { name: "PromptCreated", description: "A new prompt listing was created." },
  { name: "PromptPurchased", description: "A listing was sold (license purchased)." },
  { name: "PromptPriceUpdated", description: "A listing's price changed." },
  { name: "LicenseTransferred", description: "A license was transferred to another wallet." },
  { name: "DisputeOpened", description: "A dispute was opened against a listing." },
  { name: "DisputeResolved", description: "A dispute was resolved." },
  { name: "EncryptionRotated", description: "A prompt's encryption key was rotated." },
];

const DEFAULT_EVENTS = ["PromptPurchased"];

/** Only publicly reachable http(s) endpoints are accepted by the API. */
export function isValidEndpoint(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * The API is served by two handlers in this monorepo. The versioned handler
 * wraps the record as `{ webhook }`, while the Express controller returns the
 * bare document. Both shapes are normalised to a list here.
 */
export function normaliseSubscriptions(payload: unknown): WebhookSubscription[] {
  if (!payload || typeof payload !== "object") return [];
  const envelope = payload as Record<string, unknown>;
  const raw = envelope.webhook ?? envelope;
  if (Array.isArray(raw)) return raw as WebhookSubscription[];
  if (
    raw &&
    typeof raw === "object" &&
    typeof (raw as { url?: unknown }).url === "string"
  ) {
    return [raw as WebhookSubscription];
  }
  return [];
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const { error } = payload as { error?: unknown };
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

export default function WebhookSubscriptions() {
  const { address } = useWallet();

  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(DEFAULT_EVENTS);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/webhooks?walletAddress=${encodeURIComponent(address)}`,
      );
      if (response.status === 404) {
        // No endpoint registered yet — an empty console, not an error.
        setSubscriptions([]);
        setUrl("");
        setEvents(DEFAULT_EVENTS);
        return;
      }
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readErrorMessage(data, "Failed to load webhook subscriptions."));
        return;
      }
      const list = normaliseSubscriptions(data);
      setSubscriptions(list);
      setUrl(list[0]?.url ?? "");
      setEvents(list[0]?.events?.length ? list[0].events : DEFAULT_EVENTS);
    } catch {
      setError("Network error while loading webhook subscriptions.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [address]);

  useEffect(() => {
    if (!address) {
      setSubscriptions([]);
      setLoaded(false);
      return;
    }
    void load();
  }, [address, load]);

  const toggleEvent = (name: string) => {
    setEvents((current) =>
      current.includes(name)
        ? current.filter((event) => event !== name)
        : [...current, name],
    );
  };

  const resetForm = () => {
    setUrl(subscriptions[0]?.url ?? "");
    setEvents(
      subscriptions[0]?.events?.length ? subscriptions[0].events : DEFAULT_EVENTS,
    );
  };

  const save = async () => {
    if (!address || !isValidEndpoint(url) || events.length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setSecret(null);
    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, url: url.trim(), events }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readErrorMessage(data, "Failed to save the subscription."));
        return;
      }
      if (
        data &&
        typeof data === "object" &&
        typeof (data as { secret?: unknown }).secret === "string"
      ) {
        setSecret((data as { secret: string }).secret);
      }
      setNotice(
        subscriptions.length > 0
          ? "Subscription updated."
          : "Subscription registered.",
      );
      await load();
    } catch {
      setError("Network error while saving the subscription.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setSecret(null);
    try {
      const response = await fetch("/api/webhooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readErrorMessage(data, "Failed to remove the subscription."));
        return;
      }
      setNotice("Subscription removed.");
      setSubscriptions([]);
      setUrl("");
      setEvents(DEFAULT_EVENTS);
      await load();
    } catch {
      setError("Network error while removing the subscription.");
    } finally {
      setBusy(false);
    }
  };

  if (!address) {
    return (
      <EmptyState
        variant="custom"
        icon={PlugZap}
        title="Connect a wallet to manage webhook subscriptions"
        description="Subscriptions are scoped to your wallet address. Connect a Stellar wallet to register and manage the endpoints that receive your contract events."
      />
    );
  }

  const endpointValid = isValidEndpoint(url);
  const canSave = endpointValid && events.length > 0 && !busy;
  const hasSubscription = subscriptions.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Subscription Endpoints</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Endpoints receiving signed contract events for{" "}
            {shortenAddress(address)}.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm"
        >
          {notice}
        </div>
      )}

      {secret && (
        <div
          role="status"
          className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <p className="font-medium">
            Signing secret — copy it now, it will not be shown again.
          </p>
          <code className="block break-all font-mono text-xs">{secret}</code>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registered endpoints</CardTitle>
          <CardDescription>
            {hasSubscription
              ? `${subscriptions.length} endpoint${
                  subscriptions.length === 1 ? "" : "s"
                } registered for this wallet.`
              : "No endpoint registered for this wallet yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !loaded ? (
            <div
              className="flex items-center justify-center py-12"
              role="status"
              aria-label="Loading webhook subscriptions"
            >
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !hasSubscription ? (
            <EmptyState
              variant="custom"
              size="sm"
              icon={Globe}
              title="No subscription endpoints"
              description="Register an endpoint below to start receiving signed contract events."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Registered webhook subscription endpoints
                </caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="p-2 font-medium">
                      Endpoint
                    </th>
                    <th scope="col" className="p-2 font-medium">
                      Events
                    </th>
                    <th scope="col" className="p-2 font-medium">
                      Status
                    </th>
                    <th scope="col" className="p-2 font-medium">
                      Last delivery
                    </th>
                    <th scope="col" className="p-2 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((subscription) => (
                    <tr
                      key={subscription._id ?? subscription.url}
                      className="border-b align-top"
                    >
                      <td className="max-w-[16rem] break-all p-2 font-mono text-xs">
                        {subscription.url}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {(subscription.events ?? []).map((event) => (
                            <Badge key={event} variant="secondary">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-2">
                        {subscription.active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Disabled</Badge>
                        )}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {subscription.lastDeliveredAt
                          ? new Date(subscription.lastDeliveredAt).toLocaleString()
                          : "Not yet delivered"}
                      </td>
                      <td className="p-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUrl(subscription.url);
                              setEvents(
                                subscription.events?.length
                                  ? subscription.events
                                  : DEFAULT_EVENTS,
                              );
                              setNotice(null);
                              setSecret(null);
                            }}
                            aria-label={`Edit subscription ${subscription.url}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => void remove()}
                            disabled={busy}
                            aria-label={`Delete subscription ${subscription.url}`}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {hasSubscription ? "Update endpoint" : "Register endpoint"}
          </CardTitle>
          <CardDescription>
            The endpoint must be a publicly reachable http(s) URL. Each subscribed
            event is delivered as a signed POST request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="webhook-endpoint-url" className="text-sm font-medium">
              Endpoint URL
            </label>
            <Input
              id="webhook-endpoint-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://your-server.com/webhooks"
              aria-invalid={url.length > 0 && !endpointValid}
              aria-describedby="webhook-endpoint-url-help"
            />
            <p
              id="webhook-endpoint-url-help"
              className="text-xs text-muted-foreground"
            >
              {url.length > 0 && !endpointValid
                ? "Enter a valid http(s) URL."
                : "We POST a signed JSON payload to this URL for every subscribed event."}
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              Events ({events.length} selected)
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {AVAILABLE_EVENTS.map((event) => (
                <label
                  key={event.name}
                  htmlFor={`webhook-event-${event.name}`}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                >
                  <input
                    id={`webhook-event-${event.name}`}
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                    checked={events.includes(event.name)}
                    onChange={() => toggleEvent(event.name)}
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {event.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {event.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2">
            {hasSubscription && (
              <Button variant="ghost" onClick={resetForm} disabled={busy}>
                Clear
              </Button>
            )}
            <Button onClick={() => void save()} disabled={!canSave}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {hasSubscription ? "Update subscription" : "Register subscription"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

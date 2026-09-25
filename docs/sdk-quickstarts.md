# SDK Quickstarts

These examples use the server-side package for API-key operations and plain
`fetch` for wallet-authorized flows. Keep wallet signatures in the browser or
wallet client; never move a signing secret or webhook secret into frontend
code.

## List prompts

Install the SDK from the repository until the package is published:

```bash
npm install ./packages/server-sdk
```

Public marketplace reads do not need an API key:

```ts
import { PromptHashServerClient } from "@prompthash/server-sdk";

const client = new PromptHashServerClient({
  baseUrl: "https://api.promptmint.io",
});

const page = await client.listPrompts({ page: 1, limit: 20, sort: "upvotes" });
const prompts = page.prompts ?? page.items ?? [];
console.log({ total: page.total, prompts });
```

`listPrompts` calls `GET /api/prompts`. Use `page`, `limit`, `sort`, and
`search` to constrain the request. The response envelope may expose rows as
`prompts` or `items`; the SDK preserves the API response shape.

## Unlock a prompt

Unlocking requires a wallet challenge and a signature from the wallet that
owns the prompt entitlement. The signing call is intentionally left to the
wallet adapter in the application; do not send secret keys to this API.

```ts
const baseUrl = "https://api.promptmint.io";
const address = walletAddress;
const promptId = "42";

const challengeResponse = await fetch(`${baseUrl}/api/auth/challenge`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address, promptId }),
});
if (!challengeResponse.ok) throw new Error(`Challenge failed: ${challengeResponse.status}`);
const { token, challenge } = await challengeResponse.json();

// Use the connected Stellar wallet to sign the exact challenge returned above.
const signature = await walletAdapter.signMessage(challenge);
const signedMessage = typeof signature === "string" ? signature : signature.signedMessage;
if (!signedMessage) throw new Error("Wallet did not return a message signature");

const unlockResponse = await fetch(`${baseUrl}/api/prompts/unlock`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token, promptId, address, signedMessage }),
});
if (!unlockResponse.ok) throw new Error(`Unlock failed: ${unlockResponse.status}`);
const unlocked = await unlockResponse.json();
```

The server verifies the short-lived challenge, wallet signature, and on-chain
access before returning decrypted content. Do not log the returned content or
signature. See [the API reference](./api-reference.md#authentication) for
rate limits and response details.

## Export account data

The export flow is wallet-authorized and available on the Express API. First
request a challenge, have the wallet sign the exact challenge string, and then
submit it:

```ts
const baseUrl = "https://api.promptmint.io";
const walletAddress = "G...";

const challengeResponse = await fetch(`${baseUrl}/api/user/export/challenge`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address: walletAddress }),
});
if (!challengeResponse.ok) throw new Error(`Export challenge failed: ${challengeResponse.status}`);
const { token, challenge } = await challengeResponse.json();
const signature = await walletAdapter.signMessage(challenge);

const exportResponse = await fetch(`${baseUrl}/api/user/export`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address: walletAddress, signature, token }),
});
if (!exportResponse.ok) throw new Error(`Export request failed: ${exportResponse.status}`);
const { exportId, downloadUrl } = await exportResponse.json();

// The owner-authorized download endpoint returns the completed export file.
const fileResponse = await fetch(new URL(downloadUrl, baseUrl));
if (!fileResponse.ok) throw new Error(`Export download failed: ${fileResponse.status}`);
const exportFile = await fileResponse.blob();
```

Exports may complete asynchronously. Poll or retry the download URL according
to the status returned by the deployment. Treat export files as sensitive
personal data and delete local copies when no longer needed.

## Verify webhook deliveries

Webhook verification belongs in a trusted server process. Preserve the raw
request body before JSON middleware transforms it:

```ts
import express from "express";
import { verifyWebhook, WebhookReplayGuard } from "@prompthash/server-sdk";

const app = express();
const replayGuard = new WebhookReplayGuard({ toleranceSeconds: 300 });

app.post("/webhooks/prompt-mint", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = verifyWebhook(
      process.env.PROMPTMINT_WEBHOOK_SECRET!,
      req.body.toString("utf8"),
      req.headers,
      { replayGuard },
    );
    console.log("verified delivery", event.event, event.deliveryId);
    res.sendStatus(200);
  } catch {
    res.sendStatus(400);
  }
});
```

The helper checks the HMAC signature, timestamp window, payload envelope, and
duplicate delivery ID. Store the webhook secret outside source control. See
[`packages/server-sdk/README.md`](../packages/server-sdk/README.md) for
subscription management and the full helper API.

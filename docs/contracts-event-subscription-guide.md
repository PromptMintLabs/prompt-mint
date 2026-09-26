# Contract Event Subscription Guide

How to read PromptHash contract events from a Soroban RPC node. For the list of
events and their fields, see the [event catalog](./event-catalog.md).

## Prerequisites

- The deployed contract ID (`PUBLIC_PROMPT_HASH_CONTRACT_ID`).
- A Soroban RPC URL (`PUBLIC_STELLAR_RPC_URL`).
- `@stellar/stellar-sdk`.

## Poll for events

The reference implementation is
[`server/src/services/indexer.ts`](../server/src/services/indexer.ts). It polls
`getEvents` filtered to the contract:

```ts
import { scValToNative } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

const rpc = new Server(process.env.PUBLIC_STELLAR_RPC_URL!);

const latest = await rpc.getLatestLedger();
const response = await rpc.getEvents({
  startLedger: lastIndexedLedger + 1,
  filters: [{ type: "contract", contractIds: [process.env.PUBLIC_PROMPT_HASH_CONTRACT_ID!] }],
});

for (const event of response.events) {
  const name = scValToNative(event.topic[0]); // e.g. "PromptPurchased"
  const data = scValToNative(event.value);
  // route on `name`
}
```

- `topic[0]` is the event name; the indexer switches on it.
- `event.value` decodes to an object with the non-topic fields from the catalog.
- `event.txHash` identifies the transaction that emitted the event.

## Keep a cursor

Store the last ledger you processed (the indexer keeps it in the `IndexerState`
collection, key `prompt_hash_contract`) and resume from the next ledger on
restart. The indexer reads ledgers in batches of 2000 and polls every 5 seconds.

## Handle unknown events

Skip event names you do not recognise. The indexer logs `Unhandled event topic`
and continues, so new contract events do not break existing consumers.

## Receive events by webhook instead

If you only need creator-facing events, register a webhook rather than polling:
`POST /api/webhooks` with the `events` you want. Deliveries are signed; see
[webhook signatures](../server/docs/webhook-signatures.md) and the
webhook section of [payload versioning](./payload-versioning.md). Only the
events marked as emitted by the indexer in the catalog are delivered.

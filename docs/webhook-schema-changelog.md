# Webhook Schema Version Changelog

History of the outbound webhook payload schema. The current value is
`WEBHOOK_SCHEMA_VERSION` in
[`src/lib/api/payloadVersion.ts`](../src/lib/api/payloadVersion.ts); the envelope
is built in
[`server/src/services/webhookDispatcher.ts`](../server/src/services/webhookDispatcher.ts).
For versioning rules and how to introduce a new version, see
[payload versioning](./payload-versioning.md).

Every delivery carries the version in the body (`schemaVersion`) and in the
`X-PromptHash-Schema-Version` header. A new schema version is issued only for a
breaking change; additive changes are listed under the version they landed in.

## 2025-01-01 (current)

Envelope fields: `version`, `schemaVersion`, `event`, `deliveryId`,
`timestamp`, `data`.

Additive changes since this version was introduced (no version bump):

- 2026-07-26: `version` (numeric envelope version, currently `1`, also sent as
  `X-PromptHash-Version`) and `deliveryId` (also sent as
  `X-PromptHash-Delivery`) added to the envelope.
- 2026-07-26: `WebhookTest` event sent by `POST /api/webhooks/test`.
- 2026-07-26: `PromptPurchased`, `LicenseTransferred`, `DisputeOpened`,
  `DisputeResolved` and `EncryptionRotated` accepted as subscribable event
  names.
- 2026-08-28: `PromptCreated` and `PromptPriceUpdated` accepted as
  subscribable event names. See the [event catalog](./event-catalog.md) for
  which events are delivered.

## Deprecations and removals

None. No webhook schema version has been retired.

# Metrics Documentation

This document defines the core observability metrics emitted by the application, including their names, units, labels, and ownership. These metrics are used in our dashboards and alerts to monitor the health of the prompt unlock service and API endpoints.

## Core Metrics

### 1. `challenge_issued_total`
- **Description:** Volume of unlock challenges initiated by users.
- **Unit:** Count
- **Labels:**
  - `wallet`: The public key of the user's wallet.
  - `promptId`: The ID of the prompt being accessed.
- **Ownership:** Backend / Platform Team
- **Type:** Counter

### 2. `unlock_success_total`
- **Description:** Volume of successful prompt decryptions/unlocks.
- **Unit:** Count
- **Labels:**
  - `wallet`: The public key of the user's wallet.
  - `promptId`: The ID of the prompt unlocked.
- **Ownership:** Backend / Platform Team
- **Type:** Counter

### 3. `unlock_failure_total`
- **Description:** Failed attempts to unlock a prompt.
- **Unit:** Count
- **Labels:**
  - `wallet`: The public key of the user's wallet.
  - `promptId`: The ID of the prompt attempted.
  - `reason`: The specific failure reason (e.g., `invalid_signature`, `no_access`, `integrity_failure`).
- **Ownership:** Backend / Security Team
- **Type:** Counter
- **Note:** This metric represents user/business errors, not necessarily service failures, unless related to infrastructure.

### 4. `rate_limit_hit_total`
- **Description:** Number of requests blocked by rate limiters.
- **Unit:** Count
- **Labels:**
  - `type`: The type of rate limit hit (e.g., `challenge`, `unlock`).
  - `identifier`: The IP or Wallet address being limited.
- **Ownership:** Security / Infra Team
- **Type:** Counter

### 5. `api_request_duration_ms`
- **Description:** Latency and duration of API requests.
- **Unit:** Milliseconds (ms)
- **Labels:**
  - `path`: The API endpoint path.
  - `status`: The HTTP status code returned.
- **Ownership:** Backend Team
- **Type:** Histogram

### 6. `api_request_error_total`
- **Description:** Unexpected service failures or 5xx errors from the API.
- **Unit:** Count
- **Labels:**
  - `path`: The API endpoint path.
  - `error`: The error message or code.
- **Ownership:** Backend Team
- **Type:** Counter

### 7. `analytics_event_total`
- **Description:** Volume of accepted, privacy-safe product analytics events.
- **Unit:** Count
- **Labels:**
  - `event`: The taxonomy event name (e.g. `prompt_purchase_completed`).
- **Ownership:** Backend / Product Team
- **Type:** Counter
- **Note:** See [`docs/analytics-events.md`](../analytics-events.md) for the full event taxonomy.

### 8. `analytics_event_rejected_total`
- **Description:** Analytics events rejected at the API boundary (unknown event, invalid payload, or a payload smuggling a raw wallet address).
- **Unit:** Count
- **Labels:**
  - `reason`: One of `unknown_event`, `invalid_payload`, `raw_wallet_address`.
- **Ownership:** Backend / Security Team
- **Type:** Counter

## Usage
These metrics are structured to be parsed and aggregated by Prometheus/Datadog. Ensure that any newly added metrics follow the same convention.

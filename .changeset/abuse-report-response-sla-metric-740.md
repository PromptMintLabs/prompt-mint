---
"prompt-hash-stellar": minor
---

Add an abuse report response SLA metric (#740). When a moderator resolves or dismisses a report via `POST /api/moderation/actions`, the API now emits `abuse_report_response_duration_ms` (gauge, labeled with `targetType` and `outcome`) and `abuse_report_responded_total` (counter) measuring the time from report filing to moderator response. Both metrics are exported through `GET /api/metrics` and documented in `docs/operations/metrics.md`.

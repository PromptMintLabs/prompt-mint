---
"prompt-hash-stellar": minor
---

Add a notification history export (#752). `GET /api/notifications/export?walletAddress=<address>&format=csv` (or `format=json`, the default) returns every notification for a wallet - read and unread, newest first - as a downloadable CSV or JSON attachment. The existing `GET /api/notifications` feed still returns unread notifications only, and `PATCH /api/notifications/{id}/read` is unchanged.

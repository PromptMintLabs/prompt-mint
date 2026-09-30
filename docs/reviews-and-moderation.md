# Reviews and moderation

## Review queries

`GET /api/reviews/list` requires `promptId` and accepts `page` (default 1), `limit` (default 10, maximum 50), `sort` (`newest`, `oldest`, `helpful`, `highest`, or `lowest`), and an optional exact `rating` from 1 through 5. Invalid values return `400`; an out-of-range page returns an empty review list with accurate pagination metadata. Statistics describe every visible review and are intentionally not changed by the current page or rating filter. Removed reviews are never returned.

## Editing reviews

`PUT /api/reviews/edit` accepts a review ID, prompt ID, author address, rating, and 10–500-character text. The caller must be the original author and still have on-chain access via `hasAccess`. Each successful edit stores an immutable prior-text/rating snapshot in the review's edit history and exposes an `editedAt` timestamp. The API never returns edit-history text to public review listings.

## Helpful-vote activity alerts

Review listings include `helpfulVoteAlert`, which becomes `true` after at least five distinct wallets add helpful votes to the same review within ten minutes. Review authors and the prompt's seller see a neutral warning in the review list. This is a burst-activity signal, not a finding of manipulation: votes are not removed or blocked automatically, and moderators must investigate before taking action. The activity window and threshold are implementation heuristics and may need tuning against production traffic.

## Bulk moderation

`POST /api/moderation/actions` accepts at most 50 review removal/approval or user-warning actions. Every action needs a non-empty reason, the caller must appear in the configured `MODERATOR_ADDRESSES` allowlist, and `confirmed: true` is mandatory. The response is `207` when some items fail and includes item indexes and errors; valid items are still recorded. The audit log is append-only for this process.

Moderation deliberately has no API action for hiding or featuring prompts: those are marketplace/contract state changes and must continue through the contract's authorized owner/creator flow. An unset `MODERATOR_ADDRESSES` denies moderation access rather than granting it.

## Reported listing snapshots

When a listing is reported, the report stores an immutable snapshot of the listing's public fields as they were at report time (title, category, creator, price, image, tags, and capture time). Listings can be edited, archived, or deleted before a moderator reviews the report, so the snapshot preserves the evidence that was actually reported. Gated prompt content is never copied.

`POST /api/moderation/report` accepts an optional `listingSnapshot` object; it is normalized and length-bounded before storage, and ignored for `review` and `user` targets. The captured snapshot is returned with the report in `GET /api/moderation/queue` and in the Express `GET /api/user/reports` response, and is rendered in the moderation queue.
## Prompt abuse reports

Submitting a report matches an existing active report when the prompt, normalized reporter wallet, and reason are the same and the existing status is `pending` or `investigating`. A match returns the existing report ID with `duplicate: true` and does not create another record. Different reporters remain separate reports for corroboration; a resolved or dismissed report does not block a later submission.

These endpoints are additive. Existing callers that request only `promptId` continue to receive the first page sorted newest-first; pagination and filter metadata are additional fields.

## Abuse report response SLA metric

When a moderator resolves or dismisses a report through `POST /api/moderation/actions`, the API emits an abuse report response SLA metric measuring the time from report filing to moderator response:

- `abuse_report_response_duration_ms` (gauge) — response time in milliseconds, labeled with `targetType` and `outcome` (`resolved` or `dismissed`).
- `abuse_report_responded_total` (counter) — volume of responded reports, labeled with `targetType` and `outcome`.

Both metrics are exported via `GET /api/metrics` and documented in [`docs/operations/metrics.md`](./operations/metrics.md).

## Review retention and automated cleanup (#725)

To maintain database hygiene, protect storage budgets, and comply with the data retention policy (`docs/legal/data-retention-policy.md`), Prompt Mint runs an automated review retention and cleanup job:

- **Removed reviews**: Reviews removed by moderators are retained for 90 days (`REMOVED_REVIEW_RETENTION_DAYS`, default 90 days) to allow review authors to appeal the moderation action. After this window passes without an open appeal, the removed review is permanently pruned. If an appeal is active (`open` or `under_review`), the review is strictly preserved until appeal resolution.
- **Helpful vote activity**: The sliding-window vote activity tracking used for burst-manipulation alerts (`helpfulVoteActivity`) is pruned after 24 hours (`HELPFUL_VOTE_ACTIVITY_RETENTION_HOURS`, default 24 hours).
- **Review edit audit logs**: `ReviewEditAuditLog` records tracking previous review and seller response text are retained for 12 months (`REVIEW_EDIT_AUDIT_RETENTION_DAYS`, default 365 days), matching operational audit log retention.
- **Appeal evidence attachments**: Large binary attachments on resolved/closed appeals (`approved`, `rejected`, `withdrawn`) are cleaned up after 180 days (`RESOLVED_APPEAL_ATTACHMENT_RETENTION_DAYS`, default 180 days), freeing database storage while preserving decision records and history.

### Execution

- **Scheduled Job**: Runs daily at 02:00 UTC via cron in `server/src/server.ts` (configured via `REVIEW_RETENTION_CRON`).
- **CLI Runner**: Can be triggered manually or in CI via `yarn review:cleanup` (with optional `--dry-run` flag) in `server/scripts/reviewRetentionCleanup.ts`.
- **API Trigger**: `POST /api/review-analytics/retention/cleanup` accepts `{ dryRun?: boolean }` for operational inspection and auditing. Status is queryable via `GET /api/review-analytics/retention/status`.
- **Serverless Endpoint**: `POST /api/reviews/cleanup` is available for Vercel Cron or authenticated administrative execution.


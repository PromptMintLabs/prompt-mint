# Email Campaigns & Review Analytics (Issues #721-724)

This document describes the implementation of four feature areas:

- **Issue #721**: Winback email flow for inactive buyers
- **Issue #722**: Reactivation email flow for delisted creators
- **Issue #723**: Review response rate metric for creators
- **Issue #724**: Review deep-dive analysis for moderation admins

## Architecture Overview

### Email Campaigns

Email campaigns use the existing nodemailer SMTP infrastructure to send targeted re-engagement emails.

**Services**:
- `winbackEmailService.ts` — Identifies and emails inactive buyers
- `reactivationEmailService.ts` — Notifies delisted creators and helps them reactivate

**Configuration** (environment variables):
```bash
EMAIL_SMTP_HOST         # SMTP server hostname
EMAIL_SMTP_PORT         # SMTP port (default: 587)
EMAIL_SMTP_USER         # SMTP authentication user
EMAIL_SMTP_PASS         # SMTP authentication password
EMAIL_FROM_ADDRESS      # Sender address (default: "PromptHash <noreply@prompthash.io>")
APP_URL                 # Application base URL
SUPPORT_EMAIL           # Support contact email
WINBACK_INACTIVE_DAYS   # Inactivity threshold (default: 30 days)
REACTIVATION_DELIST_LOOKBACK_DAYS  # Delist window (default: 7 days)
```

### Review Analytics

#### Review Response Rate (Issue #723)

Tracks when creators respond to reviews and calculates engagement metrics.

**Data Model**: `ReviewResponse` schema with fields:
- `promptId` — The prompt being reviewed
- `creatorWallet` — Creator's wallet address
- `responseText` — Creator's response (1-1000 chars)
- `respondedAt` — Timestamp of response

**Key Metrics**:
- `responseRate` — Percentage of reviews the creator responds to
- `responsesCount` — Total responses in time window
- `totalReviewsReceived` — Total reviews in time window
- `lastResponseDate` — Most recent response timestamp

**API Endpoints**:
```
GET  /api/review-analytics/response-rate/:creatorWallet
POST /api/review-analytics/response-rate/batch
GET  /api/review-analytics/top-responders
POST /api/review-analytics/record-response
```

#### Review Deep-Dive Analysis (Issue #724)

Provides moderation admins with detailed insights into review patterns and risk assessment.

**Key Metrics**:

1. **Prompt-level**:
   - Total reviews received
   - Creator response rate
   - User flags / reports
   - Moderation actions taken
   - Review trend (increasing/decreasing/stable)

2. **Creator-level**:
   - Total prompts
   - Average reviews per prompt
   - Average response rate
   - Moderation risk score (0-100)
   - Delist count
   - Account suspension count

**Risk Scoring** (0-100):
```
- Low response rate (<30%): +25 points
- User flags: +5 per flag (capped at 25)
- Delisted prompts: +15 each (capped at 25)
- Account suspensions: +25 each
```

**API Endpoints** (Admin only):
```
GET  /api/review-analytics/prompt-deepdive/:promptId
GET  /api/review-analytics/creator-profile/:creatorWallet
GET  /api/review-analytics/prompt-report/:promptId
GET  /api/review-analytics/creator-report/:creatorWallet
GET  /api/review-analytics/flagged-prompts
GET  /api/review-analytics/high-risk-creators
```

## Database Schema Changes

### User Model
Added `email` field to support email notifications:
```typescript
email: {
  type: String,
  lowercase: true,
  trim: true,
  sparse: true,
}
```

### ReviewResponse Collection
```typescript
{
  promptId: String,           // Indexed
  creatorWallet: String,      // Indexed, lowercase
  responseText: String,       // 1-1000 chars
  respondedAt: Date,          // Indexed
  timestamps: true            // createdAt, updatedAt
}
```

**Indexes**:
- `{ promptId: 1, creatorWallet: 1 }`
- `{ creatorWallet: 1, respondedAt: -1 }`
- `{ promptId: 1 }`
- `{ respondedAt: -1 }`

## Email Campaign Flow

### Winback Campaign (Issue #721)

**Trigger**: Manual API call or scheduled cron job

**Process**:
1. Query purchases table for transactions older than `WINBACK_INACTIVE_DAYS`
2. Group by buyer wallet to get unique inactive buyers
3. For each buyer:
   - Check email opt-in preference
   - Fetch email address from User collection
   - Build personalized winback email
   - Send via SMTP with circuit breaker protection

**Email Template**:
- Subject: "We miss you! 🌟 New prompts you might love"
- Includes days since last purchase
- Optional category recommendation if available
- One-click unsubscribe link

### Reactivation Campaign (Issue #722)

**Trigger**: Manual API call or scheduled cron job

**Process**:
1. Query delisted prompts from last `REACTIVATION_DELIST_LOOKBACK_DAYS`
2. Group by creator wallet
3. For each creator:
   - Check email opt-in preference
   - Fetch email address from User collection
   - Build reactivation email with action items
   - Send via SMTP with circuit breaker protection

**Email Template**:
- Subject: "⚠️ Action needed: Reactivate your delisted prompts"
- Number of delisted prompts
- Delist reason (if available)
- Link to dashboard for reactivation
- Support contact information

## API Usage Examples

### Trigger Campaigns

```bash
# Winback campaign
POST /api/campaigns/winback

# Reactivation campaign
POST /api/campaigns/reactivation

# Response
{
  "status": "success",
  "processed": 150,
  "sent": 142,
  "message": "Winback campaign complete: 142 emails sent"
}
```

### Creator Review Metrics

```bash
# Get creator's response rate
GET /api/review-analytics/response-rate/GBUQWP3BOUZX34...?days=30

# Response
{
  "creatorWallet": "gbuqwp3bouzx34...",
  "totalReviewsReceived": 45,
  "responsesCount": 38,
  "responseRate": 84.4,
  "lastResponseDate": "2026-09-27T15:30:00Z",
  "timeRangeStart": "2026-08-28T18:45:30Z",
  "timeRangeEnd": "2026-09-28T18:45:30Z"
}
```

### Moderation Analysis

```bash
# Get prompt deep-dive
GET /api/review-analytics/prompt-deepdive/PROMPT_ID

# Response
{
  "promptId": "PROMPT_ID",
  "title": "Advanced TypeScript Patterns",
  "totalReviews": 150,
  "responseRate": 72.5,
  "flaggedCount": 2,
  "moderationActions": 0,
  "lastReviewDate": "2026-09-27T10:00:00Z",
  "creatorResponseCount": 109,
  "trendDirection": "increasing"
}
```

```bash
# Get creator risk profile
GET /api/review-analytics/creator-profile/GBUQWP3BOUZX34...

# Response
{
  "creatorWallet": "gbuqwp3bouzx34...",
  "promptsCount": 12,
  "averageReviewCount": 18.3,
  "averageResponseRate": 76.2,
  "moderationRiskScore": 25,
  "delistCount": 0,
  "suspensionCount": 0
}
```

## Testing

### Unit Tests

```bash
cargo test -p prompt-hash server/src/tests/winbackEmailService.test.ts
cargo test -p prompt-hash server/src/tests/reactivationEmailService.test.ts
cargo test -p prompt-hash server/src/tests/reviewResponseMetrics.test.ts
```

### Integration Tests

1. **Email Sending**:
   - Configure test SMTP credentials
   - Verify emails are queued and sent
   - Check circuit breaker behavior on SMTP failures

2. **Analytics**:
   - Create test data with reviews and responses
   - Verify metric calculations
   - Test edge cases (zero reviews, no responses, etc.)

## Monitoring & Operations

### Metrics to Monitor

- **Email Campaigns**:
  - `email_campaign_processed_total` — Buyers/creators identified
  - `email_campaign_sent_total` — Emails successfully sent
  - `email_campaign_failed_total` — Failed sends (retried by circuit breaker)

- **Review Analytics**:
  - `review_response_rate_avg` — Average creator response rate
  - `moderation_risk_score_p95` — 95th percentile risk score
  - `flagged_prompts_count` — Active flagged items

### Common Issues

**SMTP Connection Failures**:
- Check `EMAIL_SMTP_*` environment variables
- Verify firewall rules for outbound SMTP
- Check circuit breaker status in logs

**Missing Emails**:
- Verify user has `emailNotifications: true` in preferences
- Check User collection for email field
- Review SMTP error logs

**Inaccurate Metrics**:
- Ensure AnalyticsEvent records include `eventType` and `timestamp`
- Run migration to create ReviewResponse collection
- Verify database indexes are created

## Future Enhancements

1. **A/B Testing**: Support multiple email templates and track conversion
2. **Segmentation**: Target campaigns by category interest or purchase history
3. **Batch Processing**: Async job queue for large campaigns
4. **Analytics Dashboard**: UI for moderators to view analysis reports
5. **Predictive Churn**: ML model to predict at-risk creators/buyers

# Automated Secrets Rotation

## Overview

PromptMint implements automated secrets rotation for API keys, tokens, and system secrets:
1. **Automated 90-day rotation**: System secrets and API keys auto-rotate every 90 days.
2. **Overlapping validity windows**: Old secrets remain valid for a grace period (default 7 days) to ensure zero downtime.
3. **Dependent service synchronization**: In-flight token verification and dependent services seamlessly accept active secrets.
4. **Team notifications**: Team is automatically notified via webhooks (Slack/Discord/Ops), email, and persistent audit logs.

## Architecture

### Multi-Secret Support & Overlapping Validity

The system supports multiple active secrets simultaneously during an overlapping validity window (grace period):

1. **Current Secret**: The primary secret used to sign new challenge tokens and issue API keys
2. **Previous Secret**: The old secret, valid during the overlapping window for in-flight tokens and service migrations
3. **Grace Period**: Time window (default 7 days / configurable) where both secrets are valid across all dependent services
4. **Next Rotation**: Pre-scheduled 90 days from the latest rotation date

### Token Verification Flow

```
1. Client requests challenge token
   ↓
2. Server signs token with CURRENT secret
   ↓
3. Client signs challenge message
   ↓
4. Client submits unlock request with token
   ↓
5. Server verifies token against [CURRENT, PREVIOUS] secrets
   ↓
6. If valid with either secret, proceed with unlock
```

## Environment Variables

### Required Variables

- `CHALLENGE_TOKEN_SECRET`: Current active secret for signing tokens
- `ADMIN_ROTATION_TOKEN`: Authentication token for rotation endpoint

### Optional Variables (Rotation & Notifications)

- `CHALLENGE_TOKEN_SECRET_PREVIOUS`: Previous secret (valid during grace period)
- `CHALLENGE_TOKEN_ROTATION_TIMESTAMP`: Unix timestamp (ms) of last rotation
- `CHALLENGE_TOKEN_GRACE_PERIOD_MS`: Grace period duration in milliseconds (default: 7 days = 604800000 ms)
- `SECRETS_ROTATION_INTERVAL_MS`: Rotation interval (default: 90 days = 7776000000 ms)
- `ROTATION_NOTIFICATION_WEBHOOK_URL` / `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL`: Team notification webhook
- `TEAM_NOTIFICATION_EMAIL`: Ops/security notification email

## Rotation Methods

### 1. Automated 90-Day Rotation CLI & Cron

Run the automated rotation CLI:

```bash
# Check if 90 days have elapsed and rotate if due
npx tsx scripts/auto-rotate-secrets.ts

# Force immediate rotation
npx tsx scripts/auto-rotate-secrets.ts --force
```

#### Cron Setup

```bash
# Copy example cron configuration
cp scripts/cron-rotation.example /etc/cron.d/prompt-hash-rotation

# Edit with your schedule and paths
sudo nano /etc/cron.d/prompt-hash-rotation

# Example: Rotate every 30 days at 2 AM UTC
0 2 1 * * /path/to/scripts/rotate-secrets.sh --grace-period 600 >> /var/log/secret-rotation.log 2>&1
```

### 2. Manual Rotation via API

```bash
curl -X POST https://your-domain.com/api/auth/rotateSecret \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Secret rotated successfully",
  "rotationTimestamp": 1714567200000,
  "gracePeriodMs": 300000,
  "expiresAt": 1714567500000
}
```

### 3. Manual Rotation via Environment Update

For deployments without API access:

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32 | tr -d '=' | tr '+/' '-_')

# 2. Update environment variables
export CHALLENGE_TOKEN_SECRET_PREVIOUS="$CHALLENGE_TOKEN_SECRET"
export CHALLENGE_TOKEN_SECRET="$NEW_SECRET"
export CHALLENGE_TOKEN_ROTATION_TIMESTAMP=$(date +%s000)
export CHALLENGE_TOKEN_GRACE_PERIOD_MS=300000

# 3. Restart service
systemctl restart unlock-service

# 4. After grace period, clean up
unset CHALLENGE_TOKEN_SECRET_PREVIOUS
unset CHALLENGE_TOKEN_ROTATION_TIMESTAMP
```

## Rotation Schedule Recommendations

### Security Level vs. Frequency

| Security Level | Rotation Frequency | Grace Period | Use Case |
|----------------|-------------------|--------------|----------|
| **High** | Weekly | 5 minutes | Financial applications, sensitive data |
| **Standard** | Monthly (30 days) | 10 minutes | General production use |
| **Moderate** | Quarterly (90 days) | 15 minutes | Low-risk applications |

### Factors to Consider

- **Traffic Volume**: Higher traffic → longer grace periods to avoid disruption
- **Token TTL**: Challenge tokens expire after 5 minutes by default
- **Compliance**: Some regulations require specific rotation frequencies
- **Operational Capacity**: More frequent rotation requires more monitoring

## Monitoring and Alerting

### Key Metrics to Track

1. **Rotation Success Rate**
   - Alert if rotation fails
   - Retry mechanism for transient failures

2. **Token Verification Failures**
   - Spike during rotation indicates grace period too short
   - Gradual increase indicates secret compromise

3. **Grace Period Expiration**
   - Ensure previous secret is cleaned up after grace period
   - Alert if cleanup fails

### Log Monitoring

Monitor unlock service logs for:

```
✓ Secret rotation successful
✓ Token verified with current secret
⚠ Token verified with previous secret (during grace period)
✗ Token verification failed - invalid signature
```

## Troubleshooting

### Issue: Token Verification Failures After Rotation

**Symptoms:**
- Unlock requests fail with "Invalid challenge token signature"
- Errors occur immediately after rotation

**Diagnosis:**
```bash
# Check if previous secret is configured
echo $CHALLENGE_TOKEN_SECRET_PREVIOUS

# Check rotation timestamp
echo $CHALLENGE_TOKEN_ROTATION_TIMESTAMP

# Verify grace period
echo $CHALLENGE_TOKEN_GRACE_PERIOD_MS
```

**Resolution:**
1. Ensure `CHALLENGE_TOKEN_SECRET_PREVIOUS` is set to the old secret
2. Verify `CHALLENGE_TOKEN_ROTATION_TIMESTAMP` is recent
3. Increase grace period if failures persist

### Issue: Rotation Endpoint Returns 401 Unauthorized

**Symptoms:**
- Rotation script fails with HTTP 401
- API returns "Unauthorized" error

**Resolution:**
1. Verify `ADMIN_ROTATION_TOKEN` is set correctly
2. Check Authorization header format: `Bearer YOUR_TOKEN`
3. Ensure token matches server-side configuration

### Issue: Previous Secret Not Expiring

**Symptoms:**
- `CHALLENGE_TOKEN_SECRET_PREVIOUS` remains set after grace period
- Old tokens continue to work indefinitely

**Resolution:**
1. Manually clean up expired secrets:
   ```bash
   unset CHALLENGE_TOKEN_SECRET_PREVIOUS
   unset CHALLENGE_TOKEN_ROTATION_TIMESTAMP
   ```
2. Implement automated cleanup in rotation script
3. Use secret management service with TTL support

## Security Best Practices

### Secret Generation

- **Length**: Minimum 32 bytes (256 bits)
- **Entropy**: Use cryptographically secure random generator
- **Encoding**: Base64url (URL-safe, no padding)

```bash
# Good: Cryptographically secure
openssl rand -base64 32 | tr -d '=' | tr '+/' '-_'

# Bad: Weak entropy
echo "my-secret-key"
```

### Secret Storage

**Development:**
- `.env` files (never commit to git)
- Local environment variables

**Production:**
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Secret Manager

**Never:**
- Hardcode in source code
- Commit to version control
- Log in plaintext
- Share via insecure channels

### Access Control

- Limit rotation endpoint to authorized operators only
- Use strong `ADMIN_ROTATION_TOKEN` (32+ characters)
- Rotate admin token separately from challenge secrets
- Audit all rotation attempts

### Incident Response

If secret compromise is suspected:

1. **Immediate Rotation**
   ```bash
   ./scripts/rotate-secrets.sh --grace-period 0
   ```

2. **Invalidate All Tokens**
   - Set grace period to 0 to immediately invalidate old tokens
   - Force users to request new challenge tokens

3. **Audit Logs**
   - Review unlock service logs for suspicious activity
   - Check for unusual token verification patterns

4. **Notify Stakeholders**
   - Inform security team
   - Document incident for compliance

## Production Deployment Checklist

- [ ] Generate strong initial secret (32+ bytes)
- [ ] Store secrets in secure secret management service
- [ ] Configure `ADMIN_ROTATION_TOKEN` for rotation endpoint
- [ ] Set up automated rotation schedule (cron or systemd timer)
- [ ] Configure monitoring and alerting for rotation failures
- [ ] Test rotation in staging environment
- [ ] Document rotation procedures in runbook
- [ ] Train operations team on manual rotation process
- [ ] Set up log aggregation for token verification events
- [ ] Establish incident response plan for secret compromise

## API Reference

### POST /api/auth/rotateSecret

Rotate the challenge token signing secret.

**Authentication:** Bearer token via `Authorization` header

**Request:**
```http
POST /api/auth/rotateSecret HTTP/1.1
Host: your-domain.com
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Secret rotated successfully",
  "rotationTimestamp": 1714567200000,
  "gracePeriodMs": 300000,
  "expiresAt": 1714567500000
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Response (500 Internal Server Error):**
```json
{
  "error": "CHALLENGE_TOKEN_SECRET not configured"
}
```

## Future Enhancements

1. **Automatic Cleanup Worker**
   - Background job to remove expired previous secrets
   - Runs every hour to check grace period expiration

2. **Rotation History**
   - Store rotation audit trail in database
   - Track who rotated, when, and from where

3. **Multi-Region Support**
   - Coordinate rotation across multiple service instances
   - Use distributed locking to prevent race conditions

4. **Gradual Rollout**
   - Rotate secrets for percentage of traffic first
   - Monitor error rates before full rollout

5. **Emergency Rotation**
   - One-click rotation via admin dashboard
   - Immediate invalidation of all existing tokens

## Encryption Content Rotation

The system also supports rotation of the **encrypted payload** stored on-chain for each prompt. This allows creators to re-encrypt prompt content without exposing plaintext to the server.

### Architecture

Each prompt has an `encryption_version` counter (starting at 1). When a buyer purchases a prompt, the current version is recorded in their `Purchase` record. Rotation archives the current encrypted payload and creates a new version:

```
Version 1 (initial)          Version 2 (after rotation)
┌──────────────────────┐     ┌──────────────────────┐
│ Prompt.encrypted     │ ──► │ Prompt.encrypted     │ (new)
│ Prompt.wrapped_key   │     │ Prompt.wrapped_key   │ (new)
│ Prompt.content_hash  │     │ Prompt.content_hash  │ (new)
└──────────────────────┘     └──────────────────────┘
         │                              │
         ▼                              ▼
  Archived as                    (new current version)
  PromptEncryptedPayload
  (prompt_id, version=1)
```

### On-Chain Functions

#### `rotate_encryption` (creator only)

Rotates the encryption material for a prompt. Called by the creator (or operator with creator authorization):

```rust
fn rotate_encryption(
    env: Env,
    creator: Address,
    prompt_id: u128,
    encrypted_prompt: String,   // new AES-256-GCM ciphertext (base64)
    encryption_iv: String,       // new IV (base64)
    wrapped_key: String,         // new wrapped AES key (NaCL box seal, base64)
    content_hash: BytesN<32>,    // SHA-256 of the plaintext
) -> Result<u32, Error>          // returns the new version number
```

**How rotation works (no plaintext on server):**
1. Creator decrypts the prompt locally in their browser (has the plaintext)
2. Generates a **new AES-256-GCM key**
3. Re-encrypts the prompt with the new key → new `encrypted_prompt` + `encryption_iv`
4. Wraps the new AES key with the unlock service's public key → new `wrapped_key`
5. Hashes the plaintext → new `content_hash`
6. Submits all four values on-chain via `rotate_encryption`
7. The contract archives the previous payload and increments the version

The server never touches plaintext during rotation.

#### `get_prompt_encryption_version`

Retrieves a specific version's encrypted payload:

```rust
fn get_prompt_encryption_version(
    env: Env,
    prompt_id: u128,
    version: u32,
) -> Result<PromptEncryptedPayload, Error>
```

Returns `EncryptionVersionNotFound` if the requested version does not exist.

### Unlock Flow After Rotation

1. Server verifies the buyer's on-chain entitlement via `has_access`
2. Fetches `get_purchase_details` to read the buyer's `encryption_version`
3. If the buyer's version matches the prompt's current version → decrypt using prompt's live fields
4. If the buyer's version is older → fetch the archived payload via `get_prompt_encryption_version`
5. Decrypt using the correct version's `encrypted_prompt`, `encryption_iv`, and `wrapped_key`
6. Verify integrity by comparing the recomputed SHA-256 hash against the stored `content_hash`

### Graceful Degradation

- **No purchase record (legacy buyer):** Falls back to the current prompt version
- **Archived version missing:** Returns a 400 error; the prior version is preserved by the contract so this should not occur in normal operation
- **Integrity mismatch:** Returns a 500 error, indicating data corruption

### Contract Events

An `EncryptionRotated` event is emitted on each rotation:
```
prompt_id: u128
previous_version: u32
new_version: u32
rotated_at: u64
```

### Smart Contract Storage Keys

| Key | Value | Description |
|-----|-------|-------------|
| `PromptEncryptedPayload(prompt_id, version)` | `PromptEncryptedPayload` | Archived encrypted payload |
| `PromptEncryptionVersion(prompt_id)` | `u32` | Current version counter |

### New Error Codes

| Error | Code | Description |
|-------|------|-------------|
| `EncryptionVersionNotFound` | 47 | Requested version does not exist |
| `InvalidRotation` | 48 | Rotation parameters invalid |
| `VersionMismatch` | 49 | Version inconsistency detected |

## Related Documentation

- [Security Model](./security-model.md) - Overall security architecture
- [Unlock key recovery](./operations/unlock-key-recovery.md) - Unlock private key backup and recovery
- [API Reference](./api-reference.md) - Challenge-response protocol
- [Operations Runbook](./operations/runbook.md) - Operational procedures

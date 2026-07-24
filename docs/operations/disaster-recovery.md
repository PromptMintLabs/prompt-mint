# Disaster recovery objectives and regional failover

## Purpose and scope

This plan covers loss of a deployment region, destructive data loss, dependency
failure, and credential compromise for PromptMint's frontend, APIs, MongoDB,
Redis cache/rate limiter, event indexer, Stellar RPC, and unlock service.

Recovery time objective (RTO) is the maximum time from incident declaration
until the service meets its minimum recovery state. Recovery point objective
(RPO) is the maximum acceptable loss of committed service data measured backward
from the incident. On-chain contract state is authoritative and is not replaced
or reconstructed by an off-chain database.

Role names below are operational roles, not individual people. The incident
commander records the current on-call assignee for each role at incident start.

## Service objectives and dependency map

| Service                      | Accountable owner              | Critical dependencies                                                                                                                          | Minimum recovery state                                                                                                             |     RTO |                                                                                                    RPO |
| ---------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------: | -----------------------------------------------------------------------------------------------------: |
| Frontend/CDN                 | Web platform on-call           | source artifact, deployment platform, DNS, public environment configuration, APIs                                                              | static application loads from secondary region and points only to approved API/RPC endpoints                                       |  15 min |                                         0; immutable build is reproduced from Git and release artifact |
| Public and wallet APIs       | API on-call                    | serverless/runtime platform, DNS, MongoDB for data-backed routes, Redis for distributed limits, Stellar RPC for contract reads, secret manager | health and public reads pass; mutating/decrypting routes remain disabled until their dependencies pass validation                  |  30 min |                                            0 for stateless requests; in-flight requests may be retried |
| MongoDB/indexed data         | Data on-call                   | regional database cluster, cross-region replica or object-storage backup, encryption key/KMS, network policy                                   | promoted replica or verified restore accepts reads/writes and record-count/integrity checks pass                                   |  60 min | 5 min with healthy cross-region replication; 24 h when recovering from the current daily object backup |
| Redis cache and rate limiter | API on-call                    | regional Redis, namespace configuration, network policy                                                                                        | clean secondary namespace is available; cache warms naturally; conservative rate limits are active                                 |  15 min |                             0; cache and counters are disposable, and all clients must tolerate misses |
| Event indexer                | Blockchain integration on-call | Stellar RPC, contract ID/network passphrase, MongoDB, durable last-processed ledger cursor                                                     | cursor is validated, events replay to chain tip, and lag is within two ledgers                                                     | 120 min |                 0 for contract events because the ledger is replayable; cursor checkpoint RPO is 5 min |
| Stellar RPC dependency       | Blockchain integration on-call | primary and secondary providers, Stellar network, allowlisted egress                                                                           | contract/network identity checks and read simulation pass through the secondary provider                                           |  15 min |                               0; RPC is a read/submit gateway and holds no PromptMint source of record |
| Unlock and challenge service | Security on-call               | API runtime, current/previous challenge secrets, unlock private key, Stellar RPC, contract ID/network passphrase, replay store/rate limiter    | fresh challenge succeeds and an authorized canary unlock passes wallet proof, current `has_access`, decrypt, and hash verification |  30 min |                        0 for entitlement/content; challenges in flight may be invalidated and reissued |
| Backup object storage        | Data on-call                   | versioned cross-region bucket, KMS, backup role, lifecycle policy                                                                              | latest manifest and every collection object are readable and integrity hashes verify                                               |     4 h |                                                                  24 h under the current daily schedule |

The database's five-minute RPO is conditional on the managed cross-region
replica being healthy. Monitoring must advertise the degraded 24-hour RPO when
replication is unavailable. A daily backup's technical restore may complete in
about five minutes, but the 60-minute database RTO includes incident decision,
credential acquisition, integrity verification, and traffic restoration.

## Dependency paths and recovery order

```text
Git/release artifact ──> Frontend/CDN ──> Public APIs
                                      ├──> MongoDB <── Indexer <── Stellar RPC
                                      ├──> Redis
                                      └──> Unlock service ──> Stellar RPC
                                                           ├──> Soroban contract
                                                           └──> Secret manager/KMS

Object backup/KMS ──> MongoDB restore
Secondary RPC ──────> API entitlement checks + index replay
```

Recover control-plane dependencies first: incident communications, secret
manager/KMS, secondary RPC, database, Redis, APIs/unlock, indexer, then frontend
traffic. Frontend availability must not be used as evidence that unlock is safe.

## Non-negotiable security invariants

1. `has_access(wallet, prompt_id)` is queried against the configured Soroban
   contract for every unlock. Database ownership, cache entries, indexer state,
   transaction hashes, or old successful unlocks never substitute for it.
2. If both approved RPC providers are unavailable or disagree on network
   passphrase, contract ID, or ledger state, unlock fails closed. Public static
   pages may remain available in a degraded state.
3. The secondary region receives secrets only through the production secret
   manager using a distinct least-privilege runtime identity. Operators never
   copy `.env` files, paste secret values into tickets/chat, or place them in
   deployment artifacts.
4. The unlock private key must be the approved encrypted replica of the key that
   wrapped existing prompt keys. It may be decrypted only by the unlock runtime
   role. Challenge and admin-rotation secrets use separate keys and roles.
5. Logs, traces, backup manifests, exercise evidence, and health responses never
   contain prompt plaintext, wallet seeds, private keys, challenge tokens,
   signed messages, or authorization headers.
6. Restored databases and caches are treated as untrusted inputs. Contract reads
   remain authoritative, and cache namespaces are started empty after
   compromise.
7. During credential compromise, do not preserve the normal grace period for a
   suspected challenge secret. Revoke it, issue a new current secret, invalidate
   outstanding challenges, and require users to sign fresh challenges.

## Readiness requirements

- A warm secondary application region exists with traffic disabled.
- DNS/CDN changes have a TTL of five minutes or less.
- MongoDB cross-region replication and daily encrypted backups are monitored
  independently; alerts identify the currently achievable RPO.
- The backup bucket is versioned, encrypted with a DR-accessible KMS key, and
  protected from deletion by the application role.
- Primary and secondary Stellar RPC providers are configured separately.
- Secret-manager replication and secondary runtime access are verified
  quarterly without exposing secret values.
- Release artifacts are immutable and addressed by commit SHA.
- A canary test account owns only test data and has no production funds.
- Each service objective above has an alert or manual timestamp that lets the
  incident commander determine whether its RTO is at risk.

## Regional failover procedure

### 1. Declare and contain

1. Incident commander records detection time, declaration time, affected region,
   suspected cause, and current on-call owners.
2. Freeze deployments and nonessential data repair.
3. If compromise is possible, disable the affected region's runtime and human
   credentials before copying or restoring any state.
4. Put writes and unlock into maintenance mode. Static browse may remain
   read-only if it does not claim current entitlement.

### 2. Establish trusted dependencies

1. Security on-call verifies secondary-region workload identity and secret
   manager/KMS audit logs. Retrieve secrets through runtime references, never by
   displaying their values.
2. Blockchain on-call switches to the approved secondary RPC and verifies:
   network passphrase, latest ledger progression, configured contract ID, a
   known prompt read, and `has_access` for positive and negative canaries.
3. Data on-call promotes the healthy cross-region MongoDB replica. If unavailable,
   restore the newest verified backup according to
   [backup and recovery](./backup-and-recovery.md), then record the actual restore
   point and declared data-loss window.
4. Create a clean Redis namespace in the secondary region. Do not restore cache
   or replay/rate-limit keys from a compromised region.

### 3. Start services without public traffic

1. Deploy the exact last-known-good commit to the secondary region.
2. Bind region-specific runtime identities to API secrets. Confirm logs redact
   protected fields.
3. Keep unlock disabled until a wallet signature, live contract `has_access`,
   decrypt, and content-hash canary succeeds.
4. Start the indexer from the durable cursor. Rewind at least one processed
   ledger so idempotent handlers cover a partially committed batch.
5. Compare indexed record counts, cursor, and chain tip. Do not make indexer
   catch-up a prerequisite for contract-authoritative unlock.

### 4. Shift and verify traffic

1. Shift 5% of API traffic, then 25%, 50%, and 100%, holding each step for at
   least five minutes while watching errors, latency, DB saturation, rate-limit
   hits, RPC errors, unlock integrity failures, and indexer lag.
2. Shift frontend/CDN traffic only after API routes and configuration pass.
3. Stop and roll back traffic if any security invariant fails. Availability
   pressure does not authorize bypassing contract checks or secret boundaries.
4. Record the timestamp at which each service reaches its minimum recovery
   state and compare it with its RTO.

### 5. Stabilize and fail back

Do not automatically fail back. Rebuild the original region from trusted
artifacts, issue new workload credentials, restore/replicate data, repeat
canaries, and schedule a separate controlled traffic shift. Close the incident
only after backups, replication, indexer lag, alerts, and secret audit logs are
healthy.

## Tabletop exercise: regional outage plus compromised credentials

### Scenario

At 14:00 UTC the primary application region stops serving APIs. Monitoring also
shows an anomalous secret-manager read by the primary unlock runtime 12 minutes
before the outage. MongoDB replication is four minutes behind, Redis is
unreachable, and the primary Stellar RPC returns intermittent stale ledgers.
Assume the challenge signing secret and primary runtime credential may be
compromised; do not assume the unlock private key was exposed.

### Participants

- incident commander/facilitator
- web platform on-call
- API on-call
- data on-call
- blockchain integration on-call
- security on-call
- communications lead
- independent observer/timekeeper

### Timed injects and expected decisions

| Exercise time | Inject                                                      | Expected action/evidence                                                                                        |
| ------------: | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
|           T+0 | Region/API outage declared                                  | assign roles, freeze deploys, start timeline, disable unlock/writes                                             |
|           T+5 | Suspicious secret read confirmed                            | revoke primary workload identity; rotate challenge/admin credentials with zero grace; preserve audit evidence   |
|          T+10 | Replica reports four-minute lag                             | compare with five-minute conditional RPO; record restore point; promote only after integrity checks             |
|          T+15 | Primary RPC returns stale ledger                            | select secondary provider; verify network, contract, chain progression, and positive/negative access canaries   |
|          T+20 | Request to use DB purchase records while indexer catches up | reject request; demonstrate live contract-authoritative check and fail-closed behavior                          |
|          T+30 | Secondary region ready                                      | run unlock cryptographic canary and redaction checks before staged traffic                                      |
|          T+40 | 25% traffic shows elevated 429s                             | distinguish clean Redis/rate-limit warm-up from application failure; tune only through approved incident change |
|          T+55 | Original region recovers                                    | decline automatic failback; require rebuild, new credentials, validation, and a scheduled shift                 |

The facilitator withholds later injects until participants state the decision,
owner, evidence, and timestamp. No real secret is viewed or rotated in a
tabletop; use named placeholders and sanitized screenshots.

## Exercise outcome record

Create one copy of this table for every tabletop or live failover. Store the
completed record with the incident/exercise ticket and link sanitized evidence.
An exercise is not complete while a gap lacks an owner or verification date.

| Field                             | Required value                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Exercise ID and type              | unique ID; tabletop, restore drill, regional failover, or failback                         |
| Date, environment, facilitator    | UTC date; non-production by default; named facilitator                                     |
| Scenario and services exercised   | inject version and every participating service                                             |
| Participants and role assignments | names mapped to the operational roles in this plan                                         |
| Objective timestamps              | detected, declared, traffic disabled, dependency restored, canary passed, traffic restored |
| Actual RTO/RPO by service         | measured result, target, pass/fail, and evidence link                                      |
| Security invariant evidence       | RPC/contract identity, live `has_access`, secret-manager audit, log-redaction checks       |
| Data verification                 | backup/replica timestamp, record counts, index cursor, chain tip, declared loss window     |
| Overall outcome                   | pass, pass with gaps, or fail                                                              |
| Next verification date            | explicit UTC date, no later than 90 days after the exercise                                |

Track gaps and remediation separately:

| Gap ID        | Observation and risk                  | Severity | Remediation action                    | Remediation owner                   | Due date   | Status | Evidence/issue | Next verification date |
| ------------- | ------------------------------------- | -------- | ------------------------------------- | ----------------------------------- | ---------- | ------ | -------------- | ---------------------- |
| DR-EXAMPLE-01 | Replace this row with an observed gap | medium   | Define a measurable corrective action | accountable role and named assignee | YYYY-MM-DD | open   | issue/link     | YYYY-MM-DD             |

The incident commander reviews open gaps weekly. The service owner closes a gap
only after attaching verification evidence; changing documentation alone is not
verification. Security-critical gaps require another exercise before closure.

## Exercise cadence

- database restore drill: monthly
- secret-access and emergency-rotation drill: quarterly
- regional failover tabletop: quarterly
- live non-production regional failover and failback: twice yearly
- full plan review: after every material architecture change or incident, and at
  least every 90 days

## Related procedures

- [Backup and recovery](./backup-and-recovery.md)
- [Incident response](./incident-response.md)
- [Unlock operations runbook](./runbook.md)
- [Challenge secret rotation](../secret-rotation.md)
- [Security model](../security-model.md)
- [Architecture](../architecture.md)

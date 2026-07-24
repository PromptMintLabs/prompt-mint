# Listing Takedown Policy (Issue #130)

## Overview

The prompt-mint marketplace supports off-chain takedown flags to handle copyright claims, Terms of Service violations, and emergency legal actions. These flags operate **alongside** on-chain contract state and **never modify** Soroban contract storage.

## Takedown States

| State | Discovery | New Sales | Existing Purchaser Unlock |
|-------|-----------|-----------|---------------------------|
| `NONE` | Full browse/search | Allowed | Allowed (if on-chain access exists) |
| `DISCOVERY_SUPPRESSED` | Hidden from browse/search | Allowed | Allowed |
| `SALES_FROZEN` | Hidden | Blocked | Allowed |
| `EMERGENCY_SUSPENDED` | Hidden | Blocked | **Blocked** (overrides on-chain) |

### NONE

Default state. Listing is fully discoverable, purchasable, and purchasers can unlock content per on-chain entitlements.

### DISCOVERY_SUPPRESSED

Used for pending moderation review or preliminary copyright flags. The listing is not shown in browse/search results but remains accessible via:
- Direct URL or bookmark
- Cached listing detail pages
- Links in purchase history

Purchases are still permitted, and existing purchasers can unlock content normally.

### SALES_FROZEN

New purchases are blocked, but existing purchasers retain full unlock access. Appropriate for:
- Confirmed ToS violations where existing purchasers should not be harmed
- Temporary holds during creator verification
- Dispute resolution periods

### EMERGENCY_SUSPENDED

**Highest severity.** All access is suspended, including unlock for existing purchasers. Reserved exclusively for:
- Court orders (DMCA injunctions, legal takedown mandates)
- Illicit or harmful content requiring immediate access removal
- Safety-critical escalations

**This state overrides on-chain entitlements** — it is the ONLY state that blocks existing purchasers from unlocking. Application requires documented escalation with the `escalatedBy` and `escalatedAt` fields populated.

## On-Chain Integrity Guarantee

> **Off-chain takedown flags NEVER modify on-chain contract entitlements.**

- `Prompt.active` is never set to `false` by takedown logic
- `Purchase` records are never removed from the contract
- `has_access()` remains unchanged on-chain
- The `canUnlock()` function always checks the `hasOnChainAccess` parameter, and only blocks unlock when the takedown state is `EMERGENCY_SUSPENDED`

This design ensures that if the off-chain moderation system is compromised or unavailable, on-chain rights are unaffected. A takedown in the off-chain system does not burn or revoke any Stellar account's tokens or contract records.

## Emergency Legal/Safety Escalation Path

### Who can escalate

Only authorised platform administrators with documented approval from the legal/compliance team may apply `EMERGENCY_SUSPENDED`.

### Required documentation

Prior to escalation, the following must be recorded:
1. Legal reference (court order number, law enforcement case ID, or regulatory citation)
2. Escalating administrator identity (`escalatedBy`)
3. Detailed reason describing the nature of the emergency
4. Timestamp of escalation (`escalatedAt`)

All escalations produce an audit log entry. The takedown record itself stores the `escalatedBy` and `escalatedAt` fields for traceability.

### Audit trail

Every takedown state change is logged:
- State transition (from → to)
- Reason
- Escalating admin (if applicable)
- Timestamp
- Dispute ID (if disputed)

These records are queryable via the moderation audit log API.

## Reinstatement Process

### Standard reinstatement (DISCOVERY_SUPPRESSED, SALES_FROZEN)

1. Identified issue is resolved (copyright claim withdrawn, TOS compliance achieved)
2. Moderator or admin calls `reinstateListing(promptId)`
3. Listing returns to `NONE` with full discoverability, purchasability, and unlock
4. `reinstatedAt` timestamp is recorded on the takedown record

### Emergency reinstatement (EMERGENCY_SUSPENDED)

1. Legal/safety condition is lifted (court order vacated, content deemed safe)
2. Legal/compliance team authorises reinstatement
3. Admin calls `reinstateListing(promptId)`
4. All access restored — existing purchasers regain unlock capability
5. Reinstatement audit log entry created

### Timeline targets

| State | Target Resolution |
|-------|-------------------|
| DISCOVERY_SUPPRESSED | 48 hours |
| SALES_FROZEN | 7 calendar days |
| EMERGENCY_SUSPENDED | Per legal timeline (no SLA) |

## Dispute Handling

### What constitutes a valid dispute

A valid dispute must include:
- Prompt ID under takedown
- Evidence of rights ownership, fair use justification, or corrected compliance
- Contact information for the disputing party

### Dispute process

1. Disputing party submits evidence via `disputeTakedown(promptId, evidence)`
2. A unique `disputeId` is generated and stored on the takedown record
3. The takedown state remains **unchanged** during the dispute period
4. Dispute is reviewed by the moderation team
5. Resolution: either uphold (takedown remains) or reinstate

### Resolution timeline

- Initial response: within 24 hours
- Full resolution: within 5 business days
- During dispute: listing state is frozen at current takedown level (no further escalation without new grounds)

## Impact on Existing Purchasers

| Takedown State | Browse | Purchase from Detail Page | Unlock Content |
|----------------|--------|---------------------------|----------------|
| NONE | Yes | Yes | Yes (if owned) |
| DISCOVERY_SUPPRESSED | No | Yes | Yes |
| SALES_FROZEN | No | No | Yes |
| EMERGENCY_SUSPENDED | No | No | **No** |

**Key principle**: Existing purchasers retain unlock access through `DISCOVERY_SUPPRESSED` and `SALES_FROZEN`. Only `EMERGENCY_SUSPENDED` — requiring documented legal/safety escalation — blocks unlock for prior purchasers.

## Cache Invalidation Strategy

When a takedown state changes, the following caches are invalidated:

| Takedown Change | Invalidation |
|-----------------|-------------|
| Any state → NONE (reinstatement) | Browse listings, search index, listing detail page cache |
| NONE → DISCOVERY_SUPPRESSED | Browse listings, search index |
| NONE → SALES_FROZEN | Browse listings, search index |
| Any → EMERGENCY_SUSPENDED | Browse listings, search index, listing detail page cache, unlock session cache |

Cache invalidation is handled at the application layer. The `getTakedown()` function provides the source of truth; UI components should re-check takedown state on render rather than relying on stale caches.

### Cached detail page behaviour

If a user has cached a listing detail page and the listing is later takedown:

- **DISCOVERY_SUPPRESSED / SALES_FROZEN**: The unlock button still works for existing purchasers (on-chain access intact)
- **EMERGENCY_SUSPENDED**: The unlock button returns an error even for existing purchasers, with a message directing them to the dispute process

## Implementation Reference

- Module: `src/lib/moderation/takedown.ts`
- Tests: `src/test/moderation/takedown.test.ts`
- Types: `TakedownState` enum, `TakedownRecord` interface (both in `takedown.ts`)

## Testing Coverage Summary

Tests in `src/test/moderation/takedown.test.ts` cover:

- **NONE state**: discoverable, purchasable, purchasers unlock; non-purchasers blocked
- **DISCOVERY_SUPPRESSED**: not discoverable, still purchasable, purchasers unlock
- **SALES_FROZEN**: not discoverable, purchases blocked, purchasers still unlock
- **EMERGENCY_SUSPENDED**: not discoverable, purchases blocked, purchasers blocked (including creators)
- **Reinstatement**: all three elevated states → NONE, full functionality restored
- **Disputes**: dispute record created, state unchanged, non-takedown/reinstated listings return null, disputeId preserved across state changes
- **Cached pages**: existing purchasers unlock through DISCOVERY_SUPPRESSED and SALES_FROZEN, blocked at EMERGENCY_SUSPENDED
- **On-chain integrity**: `PromptRecord.active` never modified, `canUnlock` always depends on `hasOnChainAccess` (except EMERGENCY_SUSPENDED)
- **Edge cases**: takedown on non-existent listing, double takedown (overwrite), reinstatement of never-takedown listing returns null, `applyTakedown(NONE)` throws
- **Persistence**: `persistTakedowns()` / `loadTakedowns()` round-trip, load overwrites existing
- **Full lifecycle traversal**: NONE → DISCOVERY_SUPPRESSED → SALES_FROZEN → EMERGENCY_SUSPENDED → reinstate → NONE

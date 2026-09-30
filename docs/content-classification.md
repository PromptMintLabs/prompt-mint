# Content Classification & Buyer Safety Disclosures

PromptHash introduces a structured content classification system so buyers can make informed choices before purchasing a prompt license. Every listing includes a content classification attested by the creator and optional safety disclosure flags.

## Canonical Taxonomy

The following classification categories form the canonical taxonomy. Every listing must use exactly one of these values.

| Classification | Description |
|---|---|
| `general` | General purpose content not covered by other categories |
| `educational` | Educational or learning-oriented content |
| `professional` | Professional, business, or career-related content |
| `creative` | Creative, artistic, entertainment, or storytelling content |
| `technical` | Technical, programming, engineering, or scientific content |
| `sensitive` | May contain sensitive topics (politics, religion, controversial subjects) |
| `restricted` | Age-restricted or potentially offensive content |

## Safety Disclosure Flags

Creators may attach zero or more safety disclosure flags to signal specific content characteristics.

| Flag | Description |
|---|---|
| `none` | No specific safety concerns (if used, must be the only flag) |
| `ai-generated` | The prompt output is primarily AI-generated |
| `financial-advice` | Contains financial or investment advice |
| `medical` | Contains medical or health information |
| `legal` | Contains legal information or advice |
| `political` | Contains political content or commentary |

## Creator Attestation

When creating a listing, the creator selects a classification and optional safety flags. These values are stored on-chain as part of the `Prompt` struct and are attested by the creator's wallet signature.

Default classification: `general` with no safety flags.

## Moderator Override

Moderators can override a creator's classification when it is inaccurate or misleading. The override is stored separately and takes precedence in display. The creator's original classification is preserved for audit purposes.

Moderator overrides include:
- The moderator's address
- Revised classification and safety flags
- A reason for the override
- A timestamp of the review

## On-chain Contract API

### Set Classification (Creator)

```rust
fn set_classification(
    env: Env,
    creator: Address,
    prompt_id: u128,
    classification: String,
    safety_flags: Vec<String>,
) -> Result<(), Error>;
```

### Get Classification

```rust
fn get_classification(env: Env, prompt_id: u128) -> Result<(String, Vec<String>), Error>;
```

Returns the creator's attested classification (not the override).

### Get Active Classification

```rust
fn get_active_classification(env: Env, prompt_id: u128) -> Result<(String, Vec<String>), Error>;
```

Returns the moderator override if one exists, otherwise the creator's attested classification.

### Set Moderator Override

```rust
fn set_moderator_override(
    env: Env,
    moderator: Address,
    prompt_id: u128,
    classification: String,
    safety_flags: Vec<String>,
    reason: String,
) -> Result<(), Error>;
```

## Frontend Surfaces

| Surface | Display |
|---|---|
| Browse card (PromptCard) | Classification badge in header, safety flag badges in stateful row |
| Detail modal (PromptModal) | Classification in metadata grid, safety disclosures section with visual emphasis |
| Create listing form | Classification selector with descriptions, safety flag toggle buttons |

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing classification | Form validation rejects submission |
| Invalid classification value | Contract returns `InvalidClassification` error |
| Invalid safety flag | Contract returns `InvalidDisclosureFlags` error |
| Unauthorized classification change | Contract returns `Unauthorized` error |
| Moderator override by non-moderator | Contract returns `NotModerator` error |
| Conflicting classification change | Latest creator-set value overwrites previous |
| Intentionally false classification | Moderator can issue an override; on-chain audit trail exists |

## Accuracy Review Sampling

Moderators can pull a reproducible random subset of recent resolved/actioned
outcomes for re-review via `GET /api/moderation/accuracy`. The endpoint requires
a purpose-scoped moderator signature (`moderation-accuracy`) and returns
`{ sample, meta }` where `meta` is
`{ sampleSize, seed, totalEligible, generatedAt }`.

Sampling methodology:

- Eligible items are reports with status `resolved`/`dismissed` plus moderation
  log entries, constrained to the last 90 days (`ACCURACY_SAMPLE_WINDOW_MS`) or
  an explicit `since` timestamp.
- An optional `action` filter (`takedown` | `dismiss` | `all`, default `all`)
  narrows the pool so samples are not dominated by a single action type:
  `takedown` keeps `prompt_takedown`/`review_removed` logs, `dismiss` keeps
  dismissed reports and `report_dismissed` logs.
- Selection uses a zero-dependency Mulberry32 PRNG seeded from the `seed` query
  param (`hashSeedToUint32` for string seeds), with a stable id-sorted input
  order and Fisher-Yates shuffle, so the same seed yields the same sample order.
- `sampleSize` is clamped to 1–50 (default 10).
- No `accuracySummary` percentage is emitted: reports and logs carry no
  audited/appealed outcome field, so a percentage would be fictional. Add that
  field first, then derive accuracy only over items with an explicit outcome.

## Testing

The test suite covers:
- Default classification on prompt creation
- Valid classification values for all taxonomy entries
- Invalid classification values rejected
- Invalid safety flags rejected
- Unauthorized classification changes rejected
- Moderator override taking precedence over creator classification
- Moderator override by unauthorized caller rejected
- `none` flag validated as sole flag
- Classification changes emitting correct final values
- Admin-only moderator address configuration

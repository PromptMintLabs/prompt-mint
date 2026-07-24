# Production-like load testing

The k6 suite in `load-tests/prompt-mint.js` measures five paths independently:

| Scenario                  |               Default arrival rate |        Default 2-minute volume | Success threshold             |
| ------------------------- | ---------------------------------: | -----------------------------: | ----------------------------- |
| Browse/review reads       |                 20 requests/second |                    2,400 reads | errors < 1%, p95 < 750 ms     |
| Wallet challenge issuance |                  2 requests/second |                 240 challenges | success > 95%, p95 < 500 ms   |
| Authorized unlock         |                   1 request/second |           120 one-use fixtures | success > 98%, p95 < 1,500 ms |
| Indexer RPC event pages   | 4 requests/second, 100 events/page | 480 pages / 48,000 event slots | success > 99%, p95 < 1,000 ms |
| Indexer database health   |        1 worker, 5-second interval |                 about 24 reads | errors < 1%                   |

All rates, duration, virtual users, event page size, and start ledger are
configurable. Every constant-arrival-rate scenario also requires zero dropped
iterations. Increase one component at a time when finding capacity.

## Mandatory safety checklist

Never run this suite against production.

1. Deploy an isolated preview, development, or staging application backed by a
   disposable database and Redis namespace.
2. Use Stellar testnet and a dedicated testnet contract. Mainnet is rejected by
   the suite.
3. Create accounts used only for load testing. Never provide a production seed,
   user wallet, or funded mainnet identity.
4. Publish encrypted prompts marked for load testing and grant those dedicated
   accounts access on the isolated testnet contract. Do not place real prompt
   plaintext in fixtures.
5. Confirm the target hostname contains `staging`, `test`, `dev`, or `preview`
   (localhost is allowed). Known production patterns and any hostname without a
   safe marker are rejected.
6. Set `LOAD_TEST_ACK=isolated-test-data` only after completing these checks.

Generated fixture files contain fresh challenge tokens and signatures but no
secret seeds. They are ignored by Git and written with owner-only permissions.
Tokens are one-use, so generate at least `UNLOCK_RATE × duration in seconds`
fixtures. Rotate across enough wallets to remain below the configured per-wallet
unlock limit; expected 429s are recorded separately as `rate_limit_responses`.

## Prepare authorized fixtures

Provide dedicated testnet account seeds through the process environment only:

```powershell
$env:BASE_URL = "https://prompt-mint-preview.example.test"
$env:NETWORK = "Stellar Testnet"
$env:LOAD_TEST_ACK = "isolated-test-data"
$env:FIXTURES_PER_ACCOUNT = "4"
$env:LOAD_TEST_ACCOUNTS_JSON = '[{"secret":"S...","promptId":"42"}]'
corepack yarn load:fixtures
Remove-Item Env:LOAD_TEST_ACCOUNTS_JSON
```

Each account must already have on-chain access to its encrypted prompt. Challenge
preparation fails immediately on rate limiting or configuration errors.

## Execute

Install k6 using its official package for the operator's platform, then set:

```powershell
$env:BASE_URL = "https://prompt-mint-preview.example.test"
$env:RPC_URL = "https://soroban-testnet.stellar.org"
$env:NETWORK = "Stellar Testnet"
$env:CONTRACT_ID = "C...ISOLATED_TESTNET_CONTRACT"
$env:INDEX_START_LEDGER = "REPLACE_WITH_RECENT_TESTNET_LEDGER"
$env:LOAD_TEST_ACK = "isolated-test-data"
$env:FIXTURES_FILE = "./fixtures/generated.json"
$env:RESULTS_PATH = "load-results/2026-07-24.json"
corepack yarn load:test
```

For a smoke run use `DURATION=15s`, rates of `1`, and
`PREALLOCATED_VUS=5`. For a capacity run, preserve the default mix and raise one
rate by 25% per run. Do not bypass application rate limits: challenge/unlock 429s
are an intentional degradation signal.

## Bottleneck attribution

The result JSON separates:

- `component_application_duration`: total API time for browse, challenge,
  unlock, and health requests;
- `component_database_duration`: response wait time on database-backed browse
  and indexer-health endpoints;
- `component_rpc_duration`: direct Stellar `getEvents` latency used by indexing;
- `rate_limit_responses`: the share of challenge/unlock requests returning 429;
- flow-specific HTTP duration, failure, acceptance, and success metrics.

Interpret changes together. High application latency with stable database and
RPC trends points to application compute or queueing. Database and health
latency rising together points to MongoDB connection/query capacity. Direct RPC
latency or indexing RPC failures isolate the Stellar provider. Stable latency
with rising 429s indicates rate-limit capacity rather than service saturation.

## Cleanup

1. Delete `load-tests/fixtures/generated.json` and the environment variable
   containing account seeds.
2. Delete only database records bearing the load-test tenant/tag established
   during setup, then destroy the disposable database if possible.
3. Revoke the preview deployment's test secrets and delete its isolated Redis
   namespace.
4. Remove dedicated testnet signers or leave them unfunded. No mainnet funds
   should ever have been involved.
5. Keep only sanitized `load-results/*.json` artifacts in approved benchmark
   storage; the directory is ignored locally.

## Regression comparison

Run with the same fixture count, rates, duration, region, database size, RPC
provider, and commit warm-up. Compare a known-good result to a candidate:

```powershell
corepack yarn load:compare -- load-results/baseline.json load-results/candidate.json
```

The command prints p95 deltas for application, database, and RPC components,
rate-limit percentage-point change, and exits non-zero when candidate thresholds
fail. Record commit SHA, deployment region, database document counts, contract
ID, starting ledger, and k6 version beside each retained result.

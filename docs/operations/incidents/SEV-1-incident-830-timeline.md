# SEV-1 Incident #830 — Deploy Pipeline Failure (94a2fb4)

## Summary

| Field | Value |
|---|---|
| Issue | #830 |
| Severity | SEV-1 |
| Workflow | Deploy - Frontend to Vercel and Artifacts |
| Failed SHA | `94a2fb42638f7f69b10e81f5724365dca0771e5f` |
| Failing job | `contract-build` |
| Root cause | `rustc 1.89.0` on runner; `soroban-sdk@26.1.1+` requires `rustc ≥ 1.91.0`; duplicate YAML keys in `deploy.yml` caused the intended `toolchain: '1.91.0'` to be silently discarded |
| Resolved in | This PR (fix/sev1-deploy-pipeline-816-830-832) |

## Timeline

| Time (UTC) | Event |
|---|---|
| 2026-09-27 07:27 | CI run triggered on push to `main` by `barry01-hash` |
| 2026-09-27 07:26 | `contract-build` job fails — `rustc 1.89.0 is not supported by soroban-sdk@26.1.1` |
| 2026-09-27 07:27 | Automated rollback bot opens issue #830 |
| 2026-09-28 | Root cause identified: duplicate YAML keys in `deploy.yml` `contract-build` job caused `dtolnay/rust-toolchain` action to receive `toolchain: stable` (default) instead of `toolchain: 1.91.0` |

## Root Cause

`deploy.yml` contained malformed YAML with duplicate keys throughout the `contract-build` job's `Install Rust toolchain` step. YAML does not allow duplicate keys at the same level; the Actions YAML parser silently kept only one value per duplicate key, discarding the intended `toolchain: '1.91.0'`. As a result, `dtolnay/rust-toolchain` fell back to `stable` (which resolved to `1.89.0` at that point), which does not meet `soroban-sdk@26.1.1`'s minimum requirement of `rustc 1.91.0`.

Separately, `contracts.yml` also pinned `toolchain: 1.89.0` explicitly — that workflow would fail independently.

## Fix

1. **`deploy.yml`** — Rewrote the entire file to be valid YAML with no duplicate keys. `contract-build` now unambiguously sets `toolchain: "1.91.0"`.
2. **`contracts.yml`** — Updated `toolchain: 1.89.0` → `toolchain: "1.91.0"` in both occurrences (the job and any test matrix entry). This matches `rust-toolchain.toml` and the minimum requirement of the current `soroban-sdk` version.

## Health Check Status

- `/api/health` and `/api/status` to be verified on next successful deploy.

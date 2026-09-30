# SEV-1 Incident #832 — Deploy Pipeline Failure (60d742d)

## Summary

| Field | Value |
|---|---|
| Issue | #832 |
| Severity | SEV-1 |
| Workflow | Deploy - Frontend to Vercel and Artifacts |
| Failed SHA | `60d742d225bc44bb08e87bfbd336c169bbf55a95` |
| Failing job | `contract-build` |
| Root cause | Same as #830 — duplicate YAML keys in `deploy.yml` discarded `toolchain: '1.91.0'`; runner resolved `stable` to `rustc 1.89.0` |
| Resolved in | This PR (fix/sev1-deploy-pipeline-816-830-832) |

## Timeline

| Time (UTC) | Event |
|---|---|
| 2026-09-27 07:44 | CI run triggered on push to `main` by `barry01-hash` |
| 2026-09-27 07:43 | `contract-build` job fails — `rustc 1.89.0 is not supported by soroban-sdk@26.1.1` |
| 2026-09-27 07:44 | Automated rollback bot opens issue #832 |
| 2026-09-28 | Root cause confirmed identical to #830 — same deploy.yml YAML malformation, different commit SHA |

## Root Cause

Identical to incident #830. The `deploy.yml` YAML malformation was not addressed between the #830 and #832 runs (both were triggered within ~17 minutes of each other on different commits pushed in quick succession). The broken workflow file persisted across both pushes, causing the same `rustc 1.89.0` / `soroban-sdk@26.1.1` incompatibility in both runs.

## Fix

Same fix as #830. Both incidents are resolved by this single PR which rewrites `deploy.yml` and updates `contracts.yml`. No code changes are required — the failures were entirely in the CI pipeline configuration.

## Health Check Status

- `/api/health` and `/api/status` to be verified on next successful deploy.
- Since #830 and #832 were both caused by the same unaddressed configuration bug, this PR closes both simultaneously.

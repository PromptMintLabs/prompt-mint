# SEV-1 Incident #816 — Deploy Pipeline Failure (48c79e0)

## Summary

| Field | Value |
|---|---|
| Issue | #816 |
| Severity | SEV-1 |
| Workflow | Deploy - Frontend to Vercel and Artifacts |
| Failed SHA | `48c79e03ac77678e6d261d6b2c3d28cb4f731547` |
| Failing job | `generate-sbom` |
| Root cause | `npm ls` ELSPROBLEMS — stale `server/package-lock.json` |
| Resolved in | This PR (fix/sev1-deploy-pipeline-816-830-832) |

## Timeline

| Time (UTC) | Event |
|---|---|
| 2026-09-25 12:41 | CI run triggered on push to `main` by `barry01-hash` |
| 2026-09-25 12:41 | `generate-sbom` job fails — `npm error code ELSPROBLEMS`: extraneous/missing packages when `@cyclonedx/cyclonedx-npm` runs `npm ls` in `server/` |
| 2026-09-25 12:41 | Automated rollback bot opens issue #816 |
| 2026-09-28 | Root cause identified: `generate-sbom` called `npx @cyclonedx/cyclonedx-npm` without `--package-lock-only`, triggering a full `npm ls` that fails against an out-of-sync lock file |

## Root Cause

The `generate-sbom` job in `deploy.yml` ran:
```sh
cd server
npx -y @cyclonedx/cyclonedx-npm --output-format JSON --output-file ../sbom/server-sbom.json
```

Without `--package-lock-only`, `@cyclonedx/cyclonedx-npm` calls `npm ls --json --all` internally. When `server/package-lock.json` has diverged from installed packages (extraneous, missing, or invalid entries), `npm ls` exits with code 1 (`ELSPROBLEMS`), failing the entire SBOM generation step.

Simultaneously, `deploy.yml` itself contained multiple duplicate YAML keys across several steps, causing the Actions parser to silently discard intended configuration values.

## Fix

1. **`deploy.yml`** — Rewrote the entire file removing all duplicate step names, duplicate `node-version` keys, conflicting `uses:` directives, and malformed YAML structure.
2. **`generate-sbom` job** — Added `--package-lock-only` flag to both the server `npm install` step and the `@cyclonedx/cyclonedx-npm` invocation. This reads from the lock file directly without running `npm ls`, bypassing ELSPROBLEMS entirely.

## Health Check Status

- `/api/health` and `/api/status` to be verified on next successful deploy.

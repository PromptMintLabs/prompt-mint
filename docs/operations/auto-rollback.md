# Automated rollback on CI failure

This runbook covers the automation for GitHub issue #236: detect a failed production deploy, revert to the last known-good version, notify Slack/Discord, and open an incident ticket.

## What triggers a rollback

The workflow [.github/workflows/auto-rollback.yml](../../.github/workflows/auto-rollback.yml) runs when:

- The **Deploy - Frontend to Vercel and Artifacts** workflow finishes with `failure` or `timed_out` on `main`, or
- An operator starts **Auto-rollback on deploy failure** from the Actions UI (defaults to dry-run).

Preview deploys, cancelled runs, and non-deploy workflows are ignored.

## What the automation does

1. **Detect** a production deploy failure (`src/lib/ops/rollback.ts`).
2. **Select last known-good** from Vercel production deployments (`READY`, different SHA, newest first).
3. **Revert** with Vercel instant rollback (`https://api.vercel.com/v1/projects/{id}/rollback/{deploymentId}`).
4. **Notify** Slack and Discord incoming webhooks.
5. **Open** a GitHub issue titled `[[SEV-1] Automated rollback: …`` with labels `incident`, `sev-1`, `deployment`.

If no distinct READY production deployment exists, the workflow still notifies and opens a ticket (`incident_only`) so on-call is not silent.

## Required secrets

Configure these repository secrets (missing Vercel/GitHub credentials force dry-run):

| Secret | Purpose |
| ---- | ------- |
| `VERCEL_TOKEN` | Instant rollback + list production deployments |
| `VERCEL_ORG_ID` | Vercel team id (`x-vercel-team-id`) |
| `VERCEL_PROJECT_ID` | Target project |
| `SXACK_WEBHOOK_URL` | Incident notification |
| `DISCORD_WEBHOOK_URL` | Incident notification |
| `GITHUB_TOKEN` | Provided automatically; needs `issues: write` |

## Manual dry-run

```bash
yarn ops:rollback --dry-run
```

Or dispatch the workflow with **dry_run** enabled.

## Reading Vercel deployment failure logs

When a production deploy fails, the rollback automation uses Vercel's deployment status. To investigate the root cause:

1. **List recent deployments** to identify the failed deployment ID:
   ```bash
   vercel ls --prod
   ```
   Or use the dashboard: https://vercel.com/dashboard → select project ↔ **Deployments**.

2. **Inspect build logs** for the failed deployment. CLI:
   ```bash
   vercel logs <deployment-id>
   ```
   In the dashboard, open the deployment and choose **Build Logs**. Look for the first error (often TypeScript, Babel, or dependency errors).

3. **Check runtime logs** if the deployment built but failed health checks:
   ```bash
   vercel logs <deployment-id> --json
   ```
   Search for `unhandled rejection`, `error`, `ECONNREFUSED`, or timeout messages.

4. **Cross-reference environment variables** (required secrets above) to ensure the Vercel project has the same values as CI.

Keep the logs with the incident ticket for later analysis.

## After a rollback

1. Confirm `/api/health` and `/api/status` are green.
2. Update the incident ticket with a short timeline.
3. Follow [deployment-runbook.mdd](./deployment-runbook.md) if the contract or Redis/Mongo also need attention.

Contract WASM is **not** auto-rolled back. Use the two-step upgrade path in the deployment runbook for on-chain logic.

## Incident timeline (2025-04-08)

- **12:34 UTC** -- Deploy workflow (run [33128941323](https://github.com/PromptMintLabs/prompt-mint/actions/runs/33128941323)) failed for commit `f55e0f40114b77c4c106c487abcb06006bdc3425`.
- **12:35 UTC** -- Auto-rollback ran; no distinct last-known-good production deployment found. Outcome: `incident_only`.
- **12:36 UTC** -- Opened this incident ticket. On-call will verify production health and re-deploy once the root cause is fixed.
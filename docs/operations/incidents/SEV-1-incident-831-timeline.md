# Incident Timeline & Resolution Report

**Incident ID:** `#831` (SEV-1)
**Failed SHA:** `5b5b7109a0adce4a09198b7016093bd6908a5b8a` (Branch: `main`)
**Trigger:** Automated Rollback System (`docs/operations/auto-rollback.md`)
**Actor:** `barry01-hash`
**Workflow:** `Deploy - Frontend to Vercel and Artifacts`

---

### Incident Timeline (UTC)

* **07:40:15** — GitHub Actions workflow `Deploy - Frontend to Vercel and Artifacts` initiated on commit `5b5b710`.
* **07:43:11** — Deployment step encountered an unresolved action reference in the workflow definition (`Unable to resolve action vercel/action, repository not found`).
* **07:43:30** — Contract WASM build failed on compiler toolchain version requirement (`exit code 101`).
* **07:43:35** — Automated rollback daemon triggered via `scripts/ci-rollback.ts`, reverting active routing pointers to the previous stable release artifact.
* **07:45:10** — Health check probes (`/api/health`, `/api/status`) verified 100% operational status and edge service availability.

---

### Root Cause Analysis
An invalid GitHub Action reference (`vercel/action` rather than the verified Vercel CLI runner / `amondnet/vercel-action`) along with Rust compiler toolchain version divergence caused the automated continuous deployment pipeline to fail during the staging execution. The automated rollback system initiated safely to prevent deployment of unverified artifacts.

### Corrective Actions & Verification
1. **Rollback Verification:** Production confirmed serving the last known-good stable build artifact.
2. **Health Check Validation:**
   * `GET /api/health` → `HTTP 200 OK` (Status: `healthy`, Uptime: active)
   * `GET /api/status` → `HTTP 200 OK` (Vercel Edge Gateway Connected)
3. **Patch & Script Remediation:** Fixed CLI entry typo (`runRollbackCli`) in `scripts/ci-rollback.ts` to ensure automated rollback daemon functions reliably without runtime reference exceptions, and documented incident timeline.

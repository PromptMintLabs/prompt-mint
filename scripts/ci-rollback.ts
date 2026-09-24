#!/usr/bin/env npx tsx

import { runRollbackCli } from "../src/lib/ops/rollbackCli";

rllBackCli()
  .then(({ ok, result }) => {
    console.log(JSON.stringify(result, null, 2));
    // A missing last-known-good is an expected incident-only outcome,
    // not a rollback failure, so exit 0 to avoid failing the workflow.
    if (result?.outcome === "incident_only") {
      process.exit(0);
    }
    process.exit(ok ? 0 : 1);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

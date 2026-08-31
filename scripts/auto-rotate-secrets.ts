#!/usr/bin/env node

/**
 * CLI script for automated 90-day secrets rotation (#255)
 *
 * Checks if secrets are 90+ days old and rotates them with overlapping grace period,
 * or forces an immediate rotation if --force flag is passed.
 *
 * Usage:
 *   npx tsx scripts/auto-rotate-secrets.ts [--force]
 */

import { runAutomatedSecretsRotationCycle } from "../server/src/services/secretsRotationService";

async function main() {
  const force = process.argv.includes("--force");
  console.log(`[Auto-Rotate Secrets] Starting check (force=${force})...`);

  try {
    const result = await runAutomatedSecretsRotationCycle(force);
    console.log("[Auto-Rotate Secrets] Completed rotation cycle:");
    console.log(`  - System Secret Rotated: ${result.systemSecretRotated}`);
    console.log(`  - API Keys Rotated: ${result.apiKeysRotated}`);
    process.exit(0);
  } catch (error: any) {
    console.error("[Auto-Rotate Secrets] Rotation error:", error.message || error);
    process.exit(1);
  }
}

void main();

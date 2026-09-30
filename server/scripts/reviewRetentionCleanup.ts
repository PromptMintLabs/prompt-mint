/**
 * reviewRetentionCleanup.ts — Issue #725
 *
 * Standalone review retention cleanup runner — invoked by cron, CI, or admin CLI.
 *
 * Usage:
 *   ts-node scripts/reviewRetentionCleanup.ts [--dry-run]
 *
 * Environment variables:
 *   MONGODB_URI (required)
 *   REMOVED_REVIEW_RETENTION_DAYS (default: 90)
 *   REVIEW_EDIT_AUDIT_RETENTION_DAYS (default: 365)
 *   RESOLVED_APPEAL_ATTACHMENT_RETENTION_DAYS (default: 180)
 */

import mongoose from "mongoose";
import { runReviewRetentionCleanup } from "../src/services/reviewRetentionService";

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");

  await mongoose.connect(mongoUri);
  console.log(`[reviewRetention] Connected to MongoDB at ${new Date().toISOString()}`);

  try {
    const report = await runReviewRetentionCleanup({ dryRun });
    console.log("[reviewRetention] Cleanup report:", JSON.stringify(report, null, 2));
    console.log("[reviewRetention] Done.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("[reviewRetention] Fatal:", err);
  process.exit(1);
});

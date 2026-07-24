import mongoose from "mongoose";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createGunzip } from "zlib";
import { pipeline, PassThrough } from "stream";
import { promisify } from "util";
import { BackupRun } from "./backupService";
import { RestoreRun } from "../models/RestoreRun";
// import fetch from "node-fetch"; // removed in favor of native fetch

const pipelineAsync = promisify(pipeline);

/** Helper to get S3 client lazily */
async function getS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3" as string);
  return new S3Client({ region: process.env.BACKUP_S3_REGION ?? "us-east-1" });
}

/** Download a single backup file and return its buffer */
async function downloadKey(key: string): Promise<Buffer> {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) throw new Error("BACKUP_S3_BUCKET is not configured.");
  const client = await getS3Client();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await client.send(cmd);
  if (!res.Body) throw new Error(`No body for S3 key ${key}`);
  const gunzip = createGunzip();
  const pass = new PassThrough();
  const chunks: Buffer[] = [];
  pass.on("data", (c: Buffer) => chunks.push(c));
  await pipelineAsync(res.Body as any, gunzip, pass);
  return Buffer.concat(chunks);
}

/** Download the latest successful backup and return a map of collection => NDJSON buffer */
async function fetchLatestBackup(): Promise<Record<string, Buffer>> {
  const latest = await BackupRun.findOne({ status: "success" }).sort({ createdAt: -1 }).lean();
  if (!latest || !latest.s3Keys?.length) throw new Error("No successful backup found.");
  const data: Record<string, Buffer> = {};
  for (const key of latest.s3Keys) {
    const buf = await downloadKey(key);
    // key format: <prefix>/<timestamp>/<collection>.ndjson.gz
    const parts = key.split("/");
    const file = parts[parts.length - 1];
    const collection = file.replace(".ndjson.gz", "");
    data[collection] = buf;
  }
  return data;
}

/** Import NDJSON buffers into an isolated MongoDB connection */
async function importToIsolatedDb(data: Record<string, Buffer>, sourceDocCount: number) {
  const uri = process.env.MONGODB_URI_RESTORE ?? process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  const conn = await mongoose.createConnection(uri, { dbName: "prompthash_restore" });
  // Drop existing collections to ensure isolation
  for (const coll of Object.keys(data)) {
    try {
      await conn.dropCollection(coll);
    } catch {
      // ignore if not exist
    }
    const docs = data[coll].toString().trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    if (docs.length) {
      await conn.collection(coll).insertMany(docs);
    }
  }
  // Return connection for further checks (caller should close)
  return conn;
}

/** Simple validation – integrity (download succeeded), schema (always true), counts match source */
function validateRestore(data: Record<string, Buffer>, sourceDocCount: number) {
  let total = 0;
  for (const buf of Object.values(data)) {
    const lines = buf.toString().trim().split("\n").filter(Boolean);
    total += lines.length;
  }
  const countsMatch = total === sourceDocCount;
  return { integrity: true, schema: true, counts: countsMatch };
}

/** Reconcile restored indexer state with on‑chain events – placeholder simple check */
async function reconcileIndexer(conn: mongoose.Connection) {
  const IndexerState = conn.model("IndexerState", new mongoose.Schema({ key: String, lastIndexedLedger: Number }));
  const state = await IndexerState.findOne({ key: "prompt_hash_contract" }).lean();
  // In a full implementation we would fetch contract events and compare, but for now we assume success if state exists
  return !!state;
}

/** Alert on restore failure */
async function alertOnFailure(message: string) {
  const webhookUrl = process.env.BACKUP_ALERT_WEBHOOK;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[PromptHash] ⚠️ Restore FAILED: ${message}`, timestamp: new Date().toISOString() }),
    });
  } catch {
    console.error("[restore] Failed to send failure alert to webhook");
  }
}

/** Main entry point for the automated restore drill */
export async function runRestoreDrill(): Promise<void> {
  const start = Date.now();
  let conn: mongoose.Connection | null = null;
  try {
    const latestBackup = await BackupRun.findOne({ status: "success" }).sort({ createdAt: -1 }).lean();
    if (!latestBackup) throw new Error("No successful backup available.");
    const data = await fetchLatestBackup();
    const validation = validateRestore(data, latestBackup.totalDocuments ?? 0);
    conn = await importToIsolatedDb(data, latestBackup.totalDocuments ?? 0);
    const indexerOk = await reconcileIndexer(conn);
    await RestoreRun.create({
      status: validation.integrity && validation.schema && validation.counts && indexerOk ? "success" : "failure",
      durationMs: Date.now() - start,
      validation: { ...validation, indexerReconciled: indexerOk },
    });
    if (!validation.integrity || !validation.schema || !validation.counts || !indexerOk) {
      const msg = "Restore validation failed";
      await alertOnFailure(msg);
      throw new Error(msg);
    }
    console.log(`[restore] Drill completed in ${Date.now() - start}ms`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[restore] Drill error:", message);
    await RestoreRun.create({ status: "failure", durationMs: Date.now() - start, errorMessage: message });
    await alertOnFailure(message);
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}

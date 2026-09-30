import type { Migration, MigrationContext } from "./migrationRunner";

export const addReviewResponseAndEmailMigration: Migration = {
  id: "001",
  name: "Add ReviewResponse collection and email field to User",

  async up(context: MigrationContext) {
    const { db, dryRun } = context;

    if (dryRun) {
      console.log("[migration] Dry run: would add ReviewResponse collection and email index");
      return;
    }

    // Add email index to User collection
    try {
      await db.collection("users").createIndex({ email: 1 }, { sparse: true });
      console.log("[migration] Added email index to users collection");
    } catch (err) {
      console.log("[migration] Email index already exists or error:", err);
    }

    // Create ReviewResponse collection with indexes
    try {
      await db.createCollection("reviewresponses");
      console.log("[migration] Created reviewresponses collection");
    } catch (err) {
      console.log("[migration] ReviewResponse collection already exists");
    }

    try {
      await db.collection("reviewresponses").createIndex({ promptId: 1, creatorWallet: 1 });
      await db.collection("reviewresponses").createIndex({ creatorWallet: 1, respondedAt: -1 });
      await db.collection("reviewresponses").createIndex({ promptId: 1 });
      await db.collection("reviewresponses").createIndex({ respondedAt: -1 });
      console.log("[migration] Created indexes on reviewresponses collection");
    } catch (err) {
      console.log("[migration] Indexes already exist or error:", err);
    }
  },

  async down(context: MigrationContext) {
    const { db, dryRun } = context;

    if (dryRun) {
      console.log("[migration] Dry run: would remove ReviewResponse collection and email index");
      return;
    }

    try {
      await db.dropCollection("reviewresponses");
      console.log("[migration] Dropped reviewresponses collection");
    } catch (err) {
      console.log("[migration] Failed to drop reviewresponses collection:", err);
    }

    try {
      await db.collection("users").dropIndex("email_1");
      console.log("[migration] Dropped email index from users collection");
    } catch (err) {
      console.log("[migration] Failed to drop email index:", err);
    }
  },
};

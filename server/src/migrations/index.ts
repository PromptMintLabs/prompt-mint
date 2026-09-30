import type { Migration } from "./migrationRunner";
import { addReviewResponseAndEmailMigration } from "./001-add-review-response-and-email";

export const migrations: Migration[] = [
  addReviewResponseAndEmailMigration,
];
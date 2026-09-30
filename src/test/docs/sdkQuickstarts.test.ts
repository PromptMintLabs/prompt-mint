import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const quickstarts = readFileSync(path.join(root, "docs/sdk-quickstarts.md"), "utf8");
const serverSdk = readFileSync(path.join(root, "packages/server-sdk/src/index.ts"), "utf8");
const apiReference = readFileSync(path.join(root, "docs/api-reference.md"), "utf8");

describe("SDK quickstarts", () => {
  it("covers all requested workflows with the shipped API routes", () => {
    for (const section of ["## List prompts", "## Unlock a prompt", "## Export account data", "## Verify webhook deliveries"]) {
      expect(quickstarts).toContain(section);
    }
    for (const route of [
      "/api/prompts",
      "/api/auth/challenge",
      "/api/prompts/unlock",
      "/api/user/export/challenge",
      "/api/user/export/download/",
    ]) {
      expect(quickstarts).toContain(route);
      expect(apiReference).toContain(route);
    }
  });

  it("uses the SDK methods and webhook verifier that are exported", () => {
    expect(quickstarts).toContain("client.listPrompts(");
    expect(quickstarts).toContain("verifyWebhook(");
    expect(serverSdk).toContain("PromptHashServerClient");
    expect(serverSdk).toContain("verifyWebhook,");
  });
});

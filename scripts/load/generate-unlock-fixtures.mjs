import { Keypair } from "@stellar/stellar-sdk";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "");
const output = resolve(
  process.env.FIXTURES_FILE || "load-tests/fixtures/generated.json",
);
const copiesPerAccount = Number(process.env.FIXTURES_PER_ACCOUNT || 4);

function assertSafe() {
  if (process.env.LOAD_TEST_ACK !== "isolated-test-data") {
    throw new Error("LOAD_TEST_ACK=isolated-test-data is required.");
  }
  const target = new URL(baseUrl);
  if (
    !/(^localhost$|^127\.0\.0\.1$|staging|test|dev|preview)/i.test(
      target.hostname,
    ) ||
    /(^|\.)promptmint\.(com|app|io)$|prod/i.test(target.hostname)
  ) {
    throw new Error(`Refusing fixture generation against ${target.hostname}.`);
  }
  if (!/testnet/i.test(process.env.NETWORK || "")) {
    throw new Error("NETWORK must explicitly identify Stellar testnet.");
  }
  if (!Number.isInteger(copiesPerAccount) || copiesPerAccount < 1) {
    throw new Error("FIXTURES_PER_ACCOUNT must be a positive integer.");
  }
}

assertSafe();

const accounts = JSON.parse(process.env.LOAD_TEST_ACCOUNTS_JSON || "[]");
if (!Array.isArray(accounts) || accounts.length === 0) {
  throw new Error(
    "LOAD_TEST_ACCOUNTS_JSON must contain dedicated [{secret,promptId}] testnet fixtures.",
  );
}

const fixtures = [];
for (const account of accounts) {
  const keypair = Keypair.fromSecret(account.secret);
  for (let index = 0; index < copiesPerAccount; index += 1) {
    const response = await fetch(`${baseUrl}/api/auth/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: keypair.publicKey(),
        promptId: String(account.promptId),
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Challenge preparation failed (${response.status}) for ${keypair.publicKey()}.`,
      );
    }
    const challenge = await response.json();
    const signedMessage = Buffer.from(
      keypair.sign(Buffer.from(challenge.challenge, "utf8")),
    ).toString("base64");
    fixtures.push({
      fixtureTag: "promptmint-load-test",
      address: keypair.publicKey(),
      promptId: String(account.promptId),
      token: challenge.token,
      signedMessage,
    });
  }
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(fixtures, null, 2)}\n`, {
  mode: 0o600,
});
console.log(`Wrote ${fixtures.length} one-use unlock fixtures to ${output}`);

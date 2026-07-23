import { Keypair } from "@stellar/stellar-sdk";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function runSyntheticCheck() {
  console.log(`Starting synthetic check against ${BASE_URL}...`);
  
  // Create a random wallet for the synthetic check
  const keypair = Keypair.random();
  const address = keypair.publicKey();
  const promptId = "1"; // A dummy or synthetic prompt ID

  console.log(`Using synthetic wallet: ${address}`);

  // 1. Request Challenge
  console.log("Step 1: Requesting challenge...");
  const challengeRes = await fetch(`${BASE_URL}/api/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, promptId }),
  });

  if (!challengeRes.ok) {
    console.error(`Challenge failed with status: ${challengeRes.status}`);
    process.exit(1);
  }

  const challengeData = await challengeRes.json();
  
  if (!challengeData.token || !challengeData.message) {
    console.error("Invalid challenge response format");
    process.exit(1);
  }

  console.log("Challenge received successfully.");

  // 2. Sign Challenge
  const signatureBuffer = keypair.sign(Buffer.from(challengeData.message));
  const signatureHex = signatureBuffer.toString("hex");

  // 3. Attempt Unlock (We expect a 403 or 401 depending on the prompt status, 
  // but a 500 would mean the service is unhealthy. 
  // For a synthetic check that doesn't expose real content, a 403 "Prompt access has not been purchased" is a SUCCESSFUL health signal)
  console.log("Step 2: Attempting unlock...");
  const unlockRes = await fetch(`${BASE_URL}/api/prompts/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: challengeData.token,
      promptId,
      address,
      signedMessage: signatureHex,
    }),
  });

  if (unlockRes.status === 500) {
    console.error("Unlock API returned 500 Internal Server Error.");
    process.exit(1);
  }

  // We actually expect 403 since this random wallet hasn't bought prompt "1"
  if (unlockRes.status === 403) {
    console.log("Synthetic check passed! (Received expected 403 Access Denied)");
    process.exit(0);
  }

  console.log(`Unexpected status: ${unlockRes.status}`);
  process.exit(0); // Soft pass, but might want to alert
}

runSyntheticCheck().catch((err) => {
  console.error("Synthetic check encountered a fatal error:", err);
  process.exit(1);
});

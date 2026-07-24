import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for colored output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

console.log("===========================================");
console.log(" PromptMint Mainnet Runbook Pre-flight Check");
console.log("===========================================\n");

let passCount = 0;
let failCount = 0;

function pass(msg) {
  console.log(`✅ ${colors.green}PASS${colors.reset}: ${msg}`);
  passCount++;
}

function fail(msg) {
  console.log(`❌ ${colors.red}FAIL${colors.reset}: ${msg}`);
  failCount++;
}

function warn(msg) {
  console.log(`⚠️  ${colors.yellow}WARN${colors.reset}: ${msg}`);
}

// 1. Load .env manually if needed
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...values] = line.split('=');
      if (key && !process.env[key]) {
        process.env[key.trim()] = values.join('=').trim().replace(/(^"|"$)/g, '');
      }
    }
  });
}

// --- 1. Configuration Checks ---
console.log("--- 1. Configuration Checks ---");

const network = process.env.PUBLIC_STELLAR_NETWORK;
if (network === 'mainnet' || network === 'public') {
  pass("PUBLIC_STELLAR_NETWORK is set to mainnet/public.");
} else {
  warn(`PUBLIC_STELLAR_NETWORK is set to '${network}', not 'mainnet'. (Ignore if testing locally)`);
}

const contractId = process.env.PUBLIC_PROMPT_HASH_CONTRACT_ID;
if (contractId && contractId !== "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX") {
  pass("PUBLIC_PROMPT_HASH_CONTRACT_ID is configured.");
} else {
  fail("PUBLIC_PROMPT_HASH_CONTRACT_ID is missing or set to placeholder.");
}

const unlockKey = process.env.UNLOCK_PRIVATE_KEY;
if (unlockKey && unlockKey !== "your_production_unlock_private_key") {
  pass("UNLOCK_PRIVATE_KEY is configured.");
} else {
  fail("UNLOCK_PRIVATE_KEY is missing or set to placeholder.");
}

const challengeToken = process.env.CHALLENGE_TOKEN_SECRET;
if (challengeToken && challengeToken !== "super_secret_challenge_token_key") {
  pass("CHALLENGE_TOKEN_SECRET is configured.");
} else {
  fail("CHALLENGE_TOKEN_SECRET is missing or set to placeholder.");
}

// --- 2. Contract Artifacts ---
console.log("\n--- 2. Contract Artifacts ---");
const wasmPath = path.join(__dirname, '..', 'target', 'wasm32-unknown-unknown', 'release', 'prompt_hash.wasm');
if (fs.existsSync(wasmPath)) {
  pass(`Contract WASM artifact found at target/wasm32-unknown-unknown/release/prompt_hash.wasm`);
} else {
  fail("Contract WASM artifact not found. Run 'cargo build --release --target wasm32-unknown-unknown' before deployment.");
}

// --- 3. Deployment Tooling ---
console.log("\n--- 3. Deployment Tooling ---");
try {
  execSync('stellar --version', { stdio: 'ignore' });
  pass("Stellar CLI is available.");
} catch {
  fail("Stellar CLI is not installed or not in PATH.");
}

const environmentsToml = path.join(__dirname, '..', 'environments.toml');
if (fs.existsSync(environmentsToml)) {
  const content = fs.readFileSync(environmentsToml, 'utf8');
  if (content.includes('[networks.mainnet]') || content.includes('[networks.public]') || content.includes('[networks.testnet]')) {
    pass("Networks are configured in environments.toml.");
  } else {
    fail("Network configurations missing from environments.toml.");
  }
} else {
  fail("environments.toml is missing.");
}

// --- 4. Frontend / API Health Check ---
console.log("\n--- 4. Frontend / API Health Check ---");
const healthUrl = process.env.HEALTH_CHECK_URL || "http://localhost:5173/api/health";
console.log(`Pinging health endpoint: ${healthUrl}...`);

fetch(healthUrl)
  .then(res => {
    if (res.ok) {
      pass("Health endpoint returned 200 OK.");
    } else {
      warn(`Health endpoint (${healthUrl}) returned ${res.status}.`);
    }
    finish();
  })
  .catch(err => {
    warn(`Health endpoint (${healthUrl}) check failed. Make sure the server is running if testing locally, or set HEALTH_CHECK_URL. Error: ${err.message}`);
    finish();
  });

function finish() {
  console.log("\n===========================================");
  console.log(`Summary: ${colors.green}${passCount} Passed${colors.reset}, ${colors.red}${failCount} Failed${colors.reset}`);

  if (failCount > 0) {
    console.log(`${colors.red}Runbook checks failed! Please resolve the errors above before promoting.${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}All required checks passed! Ready for promotion.${colors.reset}`);
    process.exit(0);
  }
}

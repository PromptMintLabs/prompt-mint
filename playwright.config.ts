import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  globalSetup: "./src/test/global-setup.ts",
  testDir: "./src/test/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report" }],
  ],
  snapshotPathTemplate: "{testDir}/__screenshots__{projectName}/{arg}",
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "tablet",
      use: { ...devices["iPad Mini"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "yarn start",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      PUBLIC_STELLAR_NETWORK: "TESTNET",
      PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
      PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
      PUBLIC_PROMPT_HASH_CONTRACT_ID:
        "CC6P4I3KZQ7VMA27SPQ3PYT6XTV4QFK3BVG2K3SJQK5NZ2QNKM6QVZ5Q",
      PUBLIC_STELLAR_NATIVE_ASSET_CONTRACT_ID:
        "CDLZFC3SYJZDV7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVUL2HHGCYSC",
      PUBLIC_STELLAR_SIMIULMATION_ACCOUNT:
        "GCREATORACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH1234567890ABCDEFGH1234567890ABCDEFGH1234567890ABCDEFGH1234567890ABCDEFGH1234567890",
      PUBLIC_CHAT_API_BASE: "https://secret-ai-gateway.onrender.com",
      PUBLIC_UNLOCK_PUBLIC_KEY: "ZHVmbXktcHVibGljLWtleS12YWx1ZS1hZXl=",
    },
  },
});

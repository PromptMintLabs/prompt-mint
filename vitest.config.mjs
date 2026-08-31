import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react(), nodePolyfills({ include: ["buffer"] })],

  optimizeDeps: {
    exclude: ["@creit.tech/stellar-wallets-kit"],
    include: ["@stellar/stellar-sdk", "buffer"],
  },

  build: {
    commonjsOptions: {
      include: [/@creit.tech\/stellar-wallets-kit/, /node_modules/],
      transformMixedEsModules: true,
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    testTimeout: 15000,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest}.config.*",
      "**/server/**",
      "src/test/e2e/**",
      "src/test/similarityDetection.test.ts",
      "src/test/auditTrail.test.ts",
      "src/test/health.test.ts",
      "src/test/simulation.test.ts",
    ],
    coverage: {
      provider: "istanbul",
      all: false,
      reportOnFailure: true,
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "src/test/**",
        "src/stories/**",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.spec.ts",
        "src/**/*.spec.tsx",
        "src/main.tsx",
        "src/**/__tests__/**",
        "src/components/BuyerLibrary.tsx",
        "src/contracts/**",
      ],
      thresholds: {
        lines: 55,
        functions: 45,
        branches: 42,
        statements: 55,
      },
    },
    server: {
      deps: {
        inline: [/@creit\.tech\/stellar-wallets-kit/, /libsodium-wrappers/],
      },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "libsodium-wrappers": require.resolve("libsodium-wrappers"),
    },
  },
});

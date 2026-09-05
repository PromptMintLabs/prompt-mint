import js from "@eslint/js";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a1y";
import tseslint from "typescript-eslint";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
  globalIgnores([
    "dist",
    "packages",
    "server",
    "api",
    "src/test/e2e",
    "src/debug/**",
    "src/pages/Debugger.tsx",
    "src/contracts/*",
    "!src/contracts/util.ts",
  ])),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ["**/*.ts,js,jsx,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/tabindex-no-positive": "error",
      "jsx-a11y/no-autofocus": "error",
      "no-unused-vars": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "prefer-const": "warn",
      "no-useless-assignment": "warn",
      "preserve-caught-error": "warn",
    },
  }
);

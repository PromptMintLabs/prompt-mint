# Supported Stellar Wallets

This document lists which Stellar wallets have been tested with PromptMint, describes their support level, and notes known limitations. It is the authoritative reference for issue [#476](https://github.com/PromptMintLabs/prompt-mint/issues/476).

---

## Summary Table

| Wallet | Type | Support Level | Tested in CI |
|--------|------|---------------|--------------|
| [Freighter](#freighter) | Browser extension | ✅ Full | Yes |
| [Albedo](#albedo) | Web-based | ✅ Full (with caveat) | Yes |
| [xBull](#xbull) | Browser extension | ✅ Full | Yes |
| [Ledger](#ledger) | Hardware | ⚠️ Partial | No |
| [Lobstr](#lobstr) | Mobile | ⚠️ Partial | No |
| [Solar](#solar) | Mobile | ⚠️ Partial | No |
| [Rabet](#rabet) | Browser extension | ❌ Not surfaced | No |
| [Hana](#hana) | Browser extension | ❌ Not surfaced | No |
| Other SEP-0007 wallets | Various | ❌ Not surfaced | No |

**Support levels:**
- ✅ **Full** – Shown in the connection modal, unit-tested, and exercised in E2E tests.
- ⚠️ **Partial** – Mentioned in documentation or available via the underlying kit, but not surfaced in the UI and not integration-tested.
- ❌ **Not surfaced** – The underlying `@creit.tech/stellar-wallets-kit` loads the adapter via `allowAllModules()`, but the wallet is excluded from the UI's `KNOWN_WALLETS` allowlist and receives no testing.

---

## Fully Supported

### Freighter

- **Type**: Browser extension (Chrome, Brave, Firefox, Edge)
- **Download**: https://www.freighter.app/
- **Recommended**: Yes – the primary wallet for browser-based use.
- **Tested**: Unit tests in `src/test/wallet/WalletConnection.test.tsx` and `WalletIntegration.test.tsx`; E2E tests inject a Freighter stub via `localStorage` (`walletId: "freighter"`).
- **Features confirmed working**:
  - Connect / disconnect
  - Session restore on page reload
  - `getAddress()`, `getNetwork()`, `signTransaction()`, `signMessage()`
  - `stellar:accountChanged` and `stellar:networkChanged` DOM events (used for automatic reconnection when the user switches accounts or networks inside the extension)
  - Network mismatch detection (Testnet vs Mainnet banner)
- **Known issues**: If multiple Stellar-compatible extensions are installed simultaneously (e.g., Freighter + xBull), they can compete for `window.stellar`. Disable all but the intended extension; see [troubleshooting.md § 2.1](./troubleshooting.md#21-freighter-wallet-fails-to-connect).

---

### Albedo

- **Type**: Web-based (no extension required; uses a popup to `albedo.link`)
- **Download**: https://albedo.link/
- **Tested**: Unit tests in `src/test/wallet/WalletConnection.test.tsx` and `WalletIntegration.test.tsx`.
- **Features confirmed working**:
  - Connect / disconnect
  - `getAddress()`, `signTransaction()`, `signMessage()`
- **Known limitation – `getNetwork()` not supported**: Albedo does not implement the `getNetwork()` method. The app detects this at runtime (keyed on `ALBEDO_ID` from the kit) and falls back to the configured `STELLAR_NETWORK` environment variable. As a result:
  - Network mismatch detection is unavailable for Albedo; the banner will not appear if the user is on the wrong network.
  - `networkPassphrase` is not persisted to `localStorage` for Albedo sessions.
  - Code reference: `src/providers/WalletProvider.tsx` → `getSafeNetworkInfo()`.

---

### xBull

- **Type**: Browser extension (Chrome, Brave)
- **Download**: https://xbull.app/
- **Tested**: Unit tests in `src/test/wallet/WalletConnection.test.tsx` and `WalletIntegration.test.tsx`.
- **Features confirmed working**:
  - Connect / disconnect
  - `getAddress()`, `getNetwork()`, `signTransaction()`, `signMessage()`
  - Network mismatch detection
- **Known issues**: Same multi-extension conflict as Freighter; see above.

---

## Partially Supported

These wallets are referenced in documentation and/or available through `allowAllModules()` in the Stellar Wallets Kit, but are **not shown in the PromptMint connection modal** and **have not been integration-tested**.

### Ledger

- **Type**: Hardware wallet (USB / Bluetooth)
- **Status**: Listed in `docs/faq.md` as supported, but there is no code-level adapter or UI entry. The kit ships a Ledger module that `allowAllModules()` loads.
- **Limitations**:
  - Not included in `KNOWN_WALLETS` (`src/components/WalletButton.tsx`), so it never appears in the connection modal.
  - No unit or E2E tests exercise a Ledger path.
  - Hardware-specific flows (USB transport initialization, blind signing prompts) are untested.
- **To use**: Not currently possible through the PromptMint UI. Tracked for a future release.

---

### Lobstr

- **Type**: Mobile app (iOS, Android)
- **Status**: Listed in `docs/faq.md` as supported. `docs/troubleshooting.md § 2.3` documents a WalletConnect QR-code pairing flow for Lobstr on mobile, but no WalletConnect integration exists in the source code.
- **Limitations**:
  - Not in `KNOWN_WALLETS`; not shown in the UI.
  - No WalletConnect session management is implemented.
  - No tests.
- **To use**: Not currently possible through the PromptMint UI. The troubleshooting entry is forward-looking documentation.

---

### Solar

- **Type**: Mobile app (iOS, Android)
- **Status**: Mentioned in `docs/troubleshooting.md § 2.3` alongside Lobstr as a WalletConnect mobile target.
- **Limitations**: Same as Lobstr above — no UI entry, no WalletConnect implementation, no tests.

---

## Not Surfaced (Kit Available, UI Excluded)

The following wallets are loaded by `allowAllModules()` in `src/util/wallet.ts` but are filtered out by the `KNOWN_WALLETS` allowlist in `WalletButton`. They will never appear in the connection modal unless explicitly added to that constant.

### Rabet

- **Type**: Browser extension
- **Status**: Adapter available in the kit; not surfaced or tested in PromptMint.

---

### Hana

- **Type**: Browser extension
- **Status**: Adapter available in the kit; not surfaced or tested in PromptMint.

---

## How Wallet Detection Works

When the user clicks **Connect Wallet**, the following happens:

1. `getSupportedWallets()` (`src/util/wallet.ts`) calls `kit.getSupportedWallets()` from `@creit.tech/stellar-wallets-kit@^1.9.5`.
2. The result is filtered to wallets where `isAvailable === true` (meaning the extension is actually installed and detectable in the current browser).
3. That filtered list is cross-referenced against the `KNOWN_WALLETS` constant in `src/components/WalletButton.tsx`.
4. Only wallets present in **both** lists are shown in the modal.
5. If **no** wallet passes both checks, the modal is blocked and an inline error is shown: *"No supported wallet extension detected. Install Freighter, Albedo, or xBull to continue."*
6. If the detection call itself throws (e.g., a browser policy error), the UI falls back to showing all three entries from `KNOWN_WALLETS` so the user can still attempt a connection.

To add a new wallet to the UI, add its `{ id, name }` entry to `KNOWN_WALLETS` in `src/components/WalletButton.tsx`. The kit adapter must also be available (either already included via `allowAllModules()` or explicitly imported).

---

## Testing Coverage

| Test file | Wallets covered | Type |
|-----------|----------------|------|
| `src/test/wallet/WalletConnection.test.tsx` | Freighter, Albedo, xBull | Unit (jsdom) |
| `src/test/wallet/WalletIntegration.test.tsx` | Freighter, Albedo, xBull | Unit (jsdom) |
| `src/test/wallet/NetworkDetection.test.ts` | Wallet-agnostic network mismatch | Unit |
| `src/test/e2e/purchase-unlock-flow.spec.ts` | Freighter (stubbed) | E2E (Playwright) |
| `src/test/e2e/creator-listing-management.spec.ts` | Freighter (stubbed) | E2E (Playwright) |

No CI tests cover Albedo's `getNetwork` fallback path, Ledger, Lobstr, Solar, Rabet, or Hana.

---

## Related Docs

- [FAQ – Wallets & Networks](./faq.md#wallets--networks)
- [Creator Onboarding](./creator-onboarding.md)
- [Contributor Onboarding Quickstart](./contributor-onboarding-quickstart.md)
- [Troubleshooting – Wallet Connection Problems](./troubleshooting.md#2-wallet-connection-problems)
- [Security Model](./security-model.md)

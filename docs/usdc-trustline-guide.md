# USDC Trustline Setup Guide

Use this guide when a PromptMint listing accepts USDC and your Stellar wallet
reports that a trustline is missing. Wallet menus vary by version, but the asset
identity and safety checks are the same.

## Before You Add a Trustline

A Stellar asset is identified by both its asset code and its issuing account.
The label `USDC` by itself is not enough: an unrelated or counterfeit asset can
use the same code.

1. Confirm that your wallet and the PromptMint listing are on the same network.
   Mainnet and testnet assets are separate; testnet USDC has no mainnet value.
2. Get the USDC issuer account from the listing's payment details or another
   trusted PromptMint source. Verify that the issuer is the expected one for
   that network using the issuer's official documentation. Do not use an issuer
   address sent only in an unsolicited message.
3. Check that the asset code is exactly `USDC` and that the issuer address
   matches the verified issuer. If the purchase details do not show enough
   information to verify the asset, stop and contact PromptMint support.

## Add the Trustline

In Freighter or another Stellar wallet that supports trustline management:

1. Connect the wallet you intend to use for the purchase and confirm its
   network.
2. Open the wallet's asset management or add-asset screen. Choose the option
   to add a custom asset if USDC is not already listed.
3. Enter asset code `USDC` and the verified issuer account. Review both values
   carefully before continuing. A Soroban contract address beginning with `C`
   is not a substitute for the Stellar issuing account, which begins with `G`.
4. Confirm the trustline transaction in your wallet. Wait for it to be
   submitted successfully and included in a ledger.
5. If you do not already have USDC, obtain it from a trusted source on the same
   network. Creating a trustline does not fund the account.
6. Return to PromptMint, refresh the listing or checkout, and retry the
   purchase.

## XLM Reserve and Fees

Adding a trustline creates an account subentry. Your wallet needs enough XLM to
pay the transaction fee and satisfy the network's minimum balance reserve after
the trustline is created. The required reserve can change with network
parameters and other account subentries; check the amount shown by your wallet
before signing. A trustline does not spend your USDC, but it can increase the
minimum XLM balance your account must retain.

## If the Purchase Still Fails

- For `op_no_trust` or a missing-trustline message, verify the wallet network,
  USDC code, and issuer again. A trustline for a different USDC issuer does not
  satisfy the requirement.
- If those values are correct and the transaction still fails, the missing
  trustline may belong to a payment recipient rather than your buyer account.
  Share the listing and failed transaction details with PromptMint support;
  do not add an unverified asset to work around the error.
- For insufficient-balance errors while adding the trustline, fund the wallet
  with enough XLM to cover the fee and required reserve, then retry.

For general wallet and transaction troubleshooting, see
[Troubleshooting](./troubleshooting.md).
---
"prompt-hash-stellar": minor
---

Auto-detect missing trustlines when a wallet connects (#706). A new `lib/wallet/trustline` module checks the connected account on Horizon for trustlines to the non-native assets listed in `PUBLIC_STELLAR_TRUSTLINE_ASSETS` (`CODE:ISSUER`, comma-separated; empty disables the check). `useTrustlineDetection` runs the check on connect, on account change, and when the tab regains focus, and `TrustlineBanner` (shown in the prompt purchase modal) explains what is missing, including the unfunded-account and issuer-not-authorized cases. Lookup failures never block the user. Copy is translated in all seven locales.

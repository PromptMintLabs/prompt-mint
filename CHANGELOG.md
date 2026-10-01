# Changelog

All notable changes to PromptHash Stellar are documented in this file. This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Minimum balance warning on wallet connection: a banner in the purchase modal flags wallets whose native XLM balance has fallen below the Stellar minimum account reserve, with the balance, reserve, and shortfall shown; failed balance lookups never warn (#699)
- Trustline auto-detection on wallet connection: a banner in the purchase modal flags missing or unauthorized trustlines for assets listed in `PUBLIC_STELLAR_TRUSTLINE_ASSETS` (#706)
- German (`de`) and Yoruba (`yo`) UI locales, plus a key-parity test covering every locale file
- Security model and threat analysis documentation
- Third-party integration guide with SDK examples
- User-facing FAQ and knowledge base
- Automated changelog generation with changesets
- Automated rollback on CI deploy failure (last known-good, Slack/Discord, incident ticket)
- Datadog and Grafana dashboards plus PagerDuty alerts for RPC latency, error rates, active users, transaction volume, and API health

---

## [0.1.0] - 2026-08-25

### Added
- Soroban smart contract for prompt listing, pricing, and purchase tracking
- Vite + React frontend for marketplace interface
- Creator dashboard for managing prompt listings
- Buyer profile for reopening purchased prompts
- Wallet-based access verification using signed challenge messages
- Unlock service with AES-GCM encryption and key wrapping
- Rate limiting and structured logging for production hardening
- Frontend integration tests with Vitest + React Testing Library
- Health monitoring and operational metrics endpoints
- Privacy-safe analytics with closed event taxonomy
- Public sitemap endpoint for indexed active listings
- Stellar blockchain integration with XLM settlement
- Documentation for architecture, contributing, and troubleshooting

### Features
- **Encrypted Prompt Listings**: Client-side AES-256-GCM encryption before on-chain storage
- **Contract-Backed Purchases**: XLM-denominated purchases with automatic fee splits
- **Wallet-Verified Unlock**: Signature-based access verification tied to purchase rights
- **Creator Analytics**: Track sales, revenue, and buyer engagement
- **Buyer Curation**: Reopenable purchase history and prompt management
- **Multi-Network Support**: Testnet and Mainnet deployment

### Technical Stack
- Soroban smart contracts in Rust
- Stellar SDK for blockchain interaction
- React 19 + TypeScript + Vite for frontend
- Tailwind CSS and Radix UI for styling
- React Query for client-side data fetching
- libsodium + Web Crypto for encryption
- Vercel serverless functions for unlock endpoints
- Express for optional chat/proxy integrations

---

## How to Use This Changelog

- **[Unreleased]**: Changes that will be included in the next release
- **Versions**: Each released version includes a date and link to git diff
- **Categories**: Changes are grouped by type (Added, Changed, Fixed, Removed, Security)
- **Issue References**: Important fixes reference issue numbers

## Automated Changelog Generation

This changelog is automatically updated when a new version is released. The process:

1. Contributors add changeset entries in `.changeset/` during development
2. Maintainers run the release workflow
3. Changesets are compiled into a new CHANGELOG.md section
4. A new GitHub Release is created with the changelog
5. Changeset files are consumed and removed

See [.changeset/README.md](./.changeset/README.md) for instructions on adding changesets.

## Release Schedule

PromptHash follows a rolling release model:
- **Patch (0.0.x)**: Bug fixes and security patches (as needed)
- **Minor (0.x.0)**: New features (monthly)
- **Major (x.0.0)**: Breaking changes (when necessary)

## Links

- [GitHub Repository](https://github.com/PromptMintLabs/prompt-mint)
- [Issue Tracker](https://github.com/PromptMintLabs/prompt-mint/issues)
- [Releases](https://github.com/PromptMintLabs/prompt-mint/releases)

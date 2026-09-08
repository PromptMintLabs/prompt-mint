# PromptHash Stellar — Frequently Asked Questions

Welcome to the PromptHash Stellar FAQ. Find answers to common questions about buying, selling, and managing AI prompts on the Stellar blockchain.

---

## General Questions

### What is PromptHash?

PromptHash is a decentralized marketplace for buying and selling reusable AI prompt licenses. It runs on the Stellar blockchain using Soroban smart contracts.

**Key features:**
- Creators publish encrypted prompt assets with preview metadata
- Buyers purchase permanent access rights in XLM (Stellar's native asset)
- Access is wallet-verified, not tied to an account or email
- The platform charges a small fee; the rest goes directly to creators

### How is PromptHash different from other prompt marketplaces?

| Feature | PromptHash | Traditional Marketplaces |
|---------|-----------|--------------------------|
| **Blockchain** | Soroban (Stellar) | Centralized database |
| **Ownership** | Buyer owns encrypted copy | License tied to account |
| **Payments** | Direct XLM to creator | Stripe/PayPal cut |
| **Verification** | On-chain via contract | Centralized API |
| **Licensing Model** | Unlimited reuse | Limited to personal use |

### Why should I use PromptHash?

**For Creators:**
- Keep 97% of sales (3% platform fee)
- Retain ownership of your IP
- Transparent payment settlement
- Access global buyer base
- No account lockout risk

**For Buyers:**
- Permanent access to purchased prompts
- Verifiable ownership on-chain
- Control with your Stellar wallet
- No email/password to manage
- Support creator economy directly

---

## Buying & Licensing

### How do I buy a prompt?

1. **Browse**: Visit the marketplace and explore prompts
2. **Preview**: Read the preview text and see the prompt's image/category
3. **Check Balance**: Ensure your Stellar wallet has enough XLM
4. **Purchase**: Click "Buy License" and approve the transaction
5. **Unlock**: Sign a wallet challenge to verify ownership
6. **Access**: View the full prompt content in plaintext

### What do I get when I buy a prompt?

You receive:
- **Permanent access** to the encrypted prompt content
- **Verified ownership** recorded on-chain
- **Unlimited reuse rights** — you can use the prompt as much as you want
- **Redownloadable content** — reopen it anytime from your profile

### Can I get a refund if I'm not satisfied?

Currently, PromptHash does not offer automatic refunds because:
- Purchases are immutable on-chain
- Content is decrypted on-demand (not pre-downloaded)
- Hash verification ensures authenticity

**However:**
- You can report a fraudulent listing (creator provided garbage content)
- Report content that violates platform policy
- Maintainers may investigate and take corrective action

**Future feature**: Dispute resolution system with escrow refunds.

### Can I share a purchased prompt with someone else?

No. Purchased prompts are tied to your wallet address for these reasons:
- **Creator Rights**: Protects the creator's ability to earn from sales
- **Verifiable Ownership**: Only you can prove you paid
- **Access Control**: The contract checks your address during unlock

If you want to share with a team, each team member should purchase separately or contact the creator for bulk licensing (future feature).

### How many times can I use a purchased prompt?

Unlimited! Once you own a license:
- Use it in multiple projects
- Share the prompt output (but not the prompt itself) with clients
- Iterate and refine it as much as needed
- Use it commercially (unless creator specifies otherwise)

### What happens if I lose access to my wallet?

Your purchased prompts are tied to your wallet address. If you lose the wallet's private key:

1. **Use wallet recovery**: Most wallets support SEP-0005 mnemonic recovery
2. **Contact Stellar**: If you have a mnemonic, you can restore access
3. **Multi-sig accounts**: Set up a multi-sig account with trusted signers as backup

**Tip**: Always back up your mnemonic phrase in a secure location.

---

## Licensing & Pricing

### How does pricing work?

Prices are set in **XLM** (Stellar Lumens) by creators:
- Each prompt has a fixed price in XLM
- Price is set at listing creation time
- Creators can update prices anytime
- Price changes apply only to future purchases

**Examples:**
- Basic prompt: 1 XLM (~$0.20 USD)
- Intermediate prompt: 5 XLM (~$1.00 USD)
- Premium prompt: 50 XLM (~$10.00 USD)

Prices are **not fixed in USD** — they fluctuate with XLM/USD market rates.

### What fees does PromptHash take?

PromptHash takes a **3% platform fee** on all sales:
- Creator receives: 97% of purchase price
- Platform receives: 3% of purchase price

For the exact on-chain stroop math, integer rounding rules, and how splits are computed in the Soroban contract, see [Fee Model and Split Math](./fee-model-and-split-math.md).

**Example:**
- Buyer pays: 10 XLM
- Creator receives: 9.7 XLM
- Platform receives: 0.3 XLM

### How do I know the fair price?

Consider:
1. **Prompt complexity**: Simple templates vs. specialized, high-value prompts
2. **Creator reputation**: More established creators may charge more
3. **Community ratings**: Upvotes and reviews help gauge quality
4. **Comparable prompts**: Browse similar prompts to understand market rates

### Are there volume discounts or bundles?

**Current:** No automatic volume discounts.

**Future features** (planned):
- Prompt bundles (buy 3, get 5% off)
- Creator subscription passes (monthly access to all prompts)
- Affiliate rewards (earn commission on referred buyers)

---

## Wallets & Networks

### Which wallets are supported?

PromptHash works with any Stellar wallet that supports Soroban, including:
- **Freighter** (browser extension, most popular)
- **Albedo** (web-based)
- **Ledger** (hardware wallet)
- **Lobstr** (mobile)
- Any SEP-0007 compliant wallet

**Recommended**: Freighter is the easiest for browser-based purchases.

### Do I need a Stellar account?

Yes. You need:
1. A Stellar account (addresses start with `G`)
2. Some XLM to buy prompts and pay network fees
3. A supported wallet to sign transactions

**Free account creation**: Visit any Stellar wallet to create an account (no KYC required).

### What networks are supported?

PromptHash operates on:
- **Testnet** (testing, play money)
- **Mainnet** (production, real XLM)

Check which network the site is running on before purchasing.

### How do I get XLM?

1. **Exchange**: Buy on Coinbase, Kraken, Binance, etc.
2. **Faucet** (testnet only): Free XLM for testing
3. **Peer-to-peer**: Ask a friend to send you XLM
4. **ATMs**: Some locations offer crypto ATMs

**Minimum balance:** 1 XLM to create an account + prompt price + network fees.

---

## Fees & Costs

### How much do network fees cost?

**Stellar network fee**: ~0.00001 XLM per transaction (essentially free)

**PromptHash platform fee**: 3% of purchase price (paid by creator, not buyer)

**Total buyer cost**: Just the prompt price (no additional fees to you).

### Are there any hidden fees?

No. The only costs are:
- **Prompt price** (set by creator, shown in XLM)
- **Network fee** (negligible, ~$0.000001)

**No credit card fees, currency conversion fees, or subscription costs.**

### Will my XLM balance affect my wallet security?

No. Your XLM balance:
- Never reveals your private key
- Cannot be accessed without your signature
- Is protected by Stellar's consensus

**Security tip**: Always verify you're on the real PromptHash domain (HTTPS) before signing transactions.

---

## Account & Profile Management

### How do I create a seller account?

1. **Connect wallet**: Choose "Become a Creator" on PromptHash
2. **Set profile**: Add name, bio, and profile image
3. **Create listing**: Upload prompt preview, price, and encrypted content
4. **Publish**: Submit to Soroban contract

No KYC required. Your creator profile is your wallet address.

### Can I change my creator name or profile?

Yes. Profile updates are free and take effect immediately.

However, you **cannot change the creator wallet address** associated with a listing. To migrate listings:
1. Create new listings from the new wallet
2. (Future feature) Transfer ownership via contract upgrade

### How do I delete my account?

There's no "delete account" in the traditional sense because:
- Your profile is your wallet address (on Soroban)
- Your listings are immutable on-chain
- You can deactivate individual listings (set `active = false`)

**To stop selling:**
1. Deactivate all active listings
2. Stop creating new listings
3. Your wallet address remains associated with sold prompts (for buyer access)

### Can I change my wallet address?

No, not directly. Your creator wallet is permanent once listings are published.

**Workaround**: Create a new wallet and start fresh listings from there.

---

## Security & Privacy

### Is my content encrypted?

Yes. All prompts are encrypted with **AES-256-GCM** before storage on-chain:
- Only the buyer's wallet can decrypt it
- The platform doesn't store plaintext
- Even contract can't read the plaintext

### What information does PromptHash collect?

**On-chain (public):**
- Your wallet address
- Listings you created
- Purchases you made

**Off-chain (private, not shared):**
- Your email (creator account only)
- Request logs (automatically purged after 90 days)
- Unlock event logs (hashed wallet addresses)

**PromptHash never:**
- Stores your private key
- Sells your data to third parties
- Requires credit card or personal information
- Tracks you across the web (no cookies)

### Is my payment information safe?

Payments are made directly from your wallet:
- **No payment processor** (no Stripe/PayPal involvement)
- **Direct XLM transfer** to creator's wallet
- **Immutable records** on Stellar blockchain
- **Wallet-verified signatures** for authorization

### What should I do if I think my wallet was compromised?

1. **Move assets**: Transfer XLM to a new secure wallet
2. **Revoke permissions**: Most wallets auto-revoke on key rotation
3. **Notify creators**: If someone bought from your creator account
4. **Report** abuse: Contact maintainers with details

---

## Prompts & Content

### What types of prompts can I sell?

Any prompt that:
- Doesn't violate copyright or intellectual property
- Isn't illegal (no hacking guides, extreme content)
- Isn't spam or low-quality content
- Includes a preview so buyers know what they're getting

**Popular categories:**
- Business writing (emails, proposals)
- Marketing copy (ad campaigns, social media)
- Technical (API documentation, code explanations)
- Creative (storytelling, creative writing)
- Educational (study guides, explanations)

### Can I use copyrighted material?

Only if you:
- Have explicit permission from the copyright holder
- Own the copyright yourself
- The material is licensed under Creative Commons or similar

**PromptHash reserves the right** to remove listings that violate IP rights.

### What happens if someone reports my content?

1. **Review**: Maintainers review the complaint
2. **Investigation**: Determine if policy violated
3. **Action**: If valid:
   - Your listing may be deactivated
   - You'll be notified of the issue
   - You can fix and resubmit
4. **Escalation**: Repeated violations may result in account restriction

### How do I update a prompt after publishing?

You can:
- **Update metadata**: Title, category, preview text (free)
- **Change price**: Anytime, applies to future purchases
- **Deactivate**: Set `active = false` to stop sales
- **Reactivate**: Set `active = true` to resume sales

You **cannot change the encrypted content** once published. To update content:
1. Deactivate the old listing
2. Create a new listing with updated prompt
3. Existing buyers keep access to the old version

---

## Ratings & Community

### How does the rating system work?

Only **verified buyers** can upvote prompts:
- Buyers of the prompt can upvote once
- Upvotes are visible to the public (no downvotes)
- Ratings help other buyers find quality prompts

**Future feature**: Star ratings and written reviews.

### Can I remove an upvote?

Yes. You can upvote or downvote anytime after purchase.

### How are prompts ranked?

**Default sort order:**
1. Most recent (newest first)
2. Most upvotes (highest rated)
3. Most purchased (trending)

Community voting helps surface quality prompts.

---

## Technical Issues & Troubleshooting

### My purchase transaction failed. Do I lose XLM?

No. If a transaction fails:
- **Failed transactions** don't consume XLM (only gas is burned, ~0.00001 XLM)
- **Reverted transactions** are automatically rolled back
- Your balance is restored

**If you're stuck**: Contact support with your transaction hash.

### I can't unlock a prompt. What should I do?

**Possible causes:**
1. **Expired challenge**: Request a fresh unlock challenge
2. **Wrong wallet**: Unlock with the wallet you purchased from
3. **Network issue**: Try again in a few minutes
4. **Browser cache**: Clear cache and reload

**To troubleshoot:**
1. Verify you purchased from the current wallet: `hasLicense(promptId, wallet)`
2. Request a fresh challenge token
3. Check browser console for error messages
4. Try a different browser

### The content hash doesn't match. Is my prompt fake?

Hash mismatch means:
- The encrypted content was corrupted in transit
- The creator provided fraudulent content
- There's a bug in the unlock service

**Report immediately:**
1. Note the transaction hash and prompt ID
2. Contact maintainers with details
3. Provide evidence if the content seems fraudulent
4. (Future) Initiate a dispute for refund

### How do I see my transaction history?

**As a buyer:**
- Visit your profile → "Purchased Prompts"
- View all prompts you've bought
- Click prompt to see purchase details and date

**As a creator:**
- Visit your profile → "Sales History"
- See all purchases of your prompts
- Track revenue and buyer activity

**On-chain:**
- View all transactions on Stellar Expert or Dashboard
- Search by wallet address to see full blockchain history

---

## Creator-Specific Questions

### How much can I earn?

You keep **97% of each sale**:
- 3% platform fee
- Example: 10 XLM prompt = 9.7 XLM to you

**Earnings example:**
- 100 prompts × 10 XLM = 1,000 XLM total revenue
- 970 XLM to you (minus platform fee)
- At $0.20/XLM = ~$194 per prompt pack

### How do I withdraw earnings?

**On-chain:** XLM goes directly to your wallet address
- No withdrawal process
- No waiting for payouts
- Earnings appear in your wallet immediately

**To convert to fiat:**
1. Transfer XLM to an exchange (Coinbase, Kraken)
2. Sell XLM for USD/EUR/etc.
3. Withdraw to your bank account

### Can I raise my prompt price?

Yes! Price changes:
- Apply only to new purchases
- Existing buyers keep access at original price
- Effective immediately upon update

**Strategy:** Start low, increase price as you gain reviews and reputation.

### What makes a prompt successful?

1. **Clear preview**: Buyers understand what they're getting
2. **Specific use case**: "Email templates" performs better than "writing prompts"
3. **Quality content**: Ensure the prompt delivers value
4. **Reasonable price**: Competitive with similar prompts
5. **Engagement**: Respond to buyer questions
6. **Regular updates**: Improve prompts over time

---

## Refund Policy

### Will PromptHash issue refunds?

**Current policy**: No automatic refunds. Reasoning:
- Purchases are on-chain (immutable)
- Ownership is cryptographically verified
- Content is provided immediately upon purchase

**Exceptions** (case-by-case review):
- Fraudulent content (creator provided garbage)
- Content violates platform policy
- Severe technical issues with unlock

**Request refund process:**
1. Contact maintainers with transaction hash and reason
2. Provide evidence if fraud suspected
3. Maintainers review and decide (may take 5-7 days)
4. If approved, refund processed to your wallet

### Future refund system

Planned improvements:
- Dispute resolution with evidence submission
- Escrow-backed purchases (50/50 until delivery)
- Dispute resolution committee (community vote)

---

## Getting Help

### Where can I report a problem?

**Report issues at:**
- [GitHub Issues](https://github.com/PromptMintLabs/prompt-mint/issues)
- [Discord Community](https://discord.gg/prompthash) (when available)
- Email: support@prompthash.io (when available)

### How do I report fraudulent content?

1. Click "Report Content" on the listing
2. Select the reason (spam, copyright, fraud, etc.)
3. Provide details and evidence
4. Maintainers review within 24-48 hours

### Can I suggest a feature?

Yes! Open a feature request on GitHub:
- Describe the feature clearly
- Explain why you need it
- Reference similar features elsewhere

Community voting helps prioritize features.

---

## Legal & Compliance

### Do I need to pay taxes on prompt sales?

**Tax responsibility**: You are responsible for your own tax obligations. Consult a tax professional in your jurisdiction regarding:
- Income from crypto sales
- Capital gains on XLM holdings
- Seller reporting requirements

PromptHash does not provide tax advice or issue tax forms.

### What's the refund policy?

See [Refund Policy](#refund-policy) section above.

### Can I resell prompts?

No. Reselling violates the license terms:
- You own a personal copy
- You may not redistribute the content
- The creator retains IP rights

**Legal basis**: Selling a prompt you purchased without creator consent is copyright infringement.

### What data does PromptHash retain?

**Indefinitely:**
- On-chain transactions (blockchain history)
- Listing metadata (creator, price, content hash)

**Temporarily (90 days):**
- API request logs (hashed wallet addresses)
- Unlock event logs (privacy-safe analytics)

**Never:**
- Plaintext content
- Private keys
- Personal information beyond wallet address

### Is PromptHash GDPR compliant?

PromptHash doesn't collect personal data requiring GDPR compliance:
- No email (for creators on testnet only)
- No real names required
- No cookies or tracking

However:
- Blockchain transactions are public and permanent
- You can request data deletion, but blockchain records remain

---

## Getting Started

### I'm a buyer. How do I start?

1. Install **Freighter** wallet (browser extension)
2. Create a Stellar account (free)
3. Buy XLM from an exchange
4. Transfer XLM to your Freighter wallet
5. Visit PromptHash and connect your wallet
6. Browse and purchase prompts!

### I'm a creator. How do I start?

1. Connect your Stellar wallet
2. Click "Become a Creator"
3. Set your profile (name, bio)
4. Create your first listing
5. Write a preview, set a price, encrypt your prompt
6. Publish to Soroban
7. Earn XLM from sales!

---

## Still have questions?

- **Browse docs**: Check [docs/](../docs/) for technical details
- **Report issues**: [GitHub Issues](https://github.com/PromptMintLabs/prompt-mint/issues)
- **Read more**: [README.md](../README.md), [Architecture](architecture.md)

Happy prompting! 🚀

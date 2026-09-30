# PromptMint Component Library & Storybook Guide

## 1. Overview & Architecture

PromptMint features a comprehensive UI component system built with **React 19**, **Tailwind CSS**, and **Radix UI Primitives**. The component library is fully cataloged and documented via Storybook.

### Storybook Quickstart
```bash
# Launch Storybook development server
yarn storybook

# Build static Storybook documentation bundle
yarn build-storybook
```

---

## 2. Component Catalog (54+ Components)

### 2.1 Core UI Primitives (`src/components/ui/`)
- **Button** (`src/components/ui/button.tsx`): Versatile interactive button with variants (`default`, `secondary`, `destructive`, `outline`, `ghost`, `link`), sizes (`sm`, `md`, `lg`, `icon`), loading states, and icon support.
- **Card** (`src/components/ui/card.tsx`): Modular container primitives (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).
- **Avatar** (`src/components/ui/avatar.tsx`): Profile pictures with fallback initials.
- **Badge** (`src/components/ui/badge.tsx`): Status and metadata pills.
- **Input** (`src/components/ui/input.tsx`): Text, password, number, and search fields.
- **Textarea** (`src/components/ui/textarea.tsx`): Multiline text input for prompt contents.
- **Select** (`src/components/ui/select.tsx`): Accessible dropdown selection.
- **DropdownMenu** (`src/components/ui/dropdown-menu.tsx`): Popover menu with items, separators, and shortcuts.
- **Slider** (`src/components/ui/slider.tsx`): Continuous and stepped numeric range inputs.
- **Sheet** (`src/components/ui/sheet.tsx`): Off-canvas sliding drawers for mobile navigation and cart.
- **Tabs** (`src/components/ui/tabs.tsx`): Segmented tab navigation.
- **Progress** (`src/components/ui/progress.tsx`): Deterministic and indeterminate progress bars.
- **EmptyState** (`src/components/ui/EmptyState.tsx`): Actionable empty placeholder view with iconography.
- **SafeImage** (`src/components/ui/SafeImage.tsx`): Image component with error handling and fallback placeholders.

### 2.2 Marketplace & Browsing
- **SearchBar** (`src/components/SearchBar.tsx`): Debounced search input with query clear actions.
- **MarketplaceFilters** (`src/components/MarketplaceFilters.tsx`): Multi-criteria filter sidebar (categories, price range, sorting).
- **FreshnessBadge** (`src/components/FreshnessBadge.tsx`): Relative time indicator (New, Recently Updated).
- **IntegrityBadge** (`src/components/IntegrityBadge.tsx`): On-chain SHA-256 cryptographic verification seal.
- **PromotionalPrice** (`src/components/PromotionalPrice.tsx`): Discount badge with original price strikethrough.
- **CurrencyPrice** (`src/components/CurrencyPrice.tsx`): Stroops to XLM / USD price renderer.
- **CurrencyToggle** (`src/components/CurrencyToggle.tsx`): Toggle currency display mode between XLM and USD.
- **WatermarkedPreview** (`src/components/WatermarkedPreview.tsx`): Blurred text teaser with prompt unlock overlay.
- **MarkdownPreview** (`src/components/MarkdownPreview.tsx`): Syntax-highlighted Markdown renderer.
- **PromptTrustMetadata** (`src/components/PromptTrustMetadata.tsx`): Creator reputation, sales count, and trust badges.
- **RecentlyViewed** (`src/components/RecentlyViewed.tsx`): Client-side carousel of recently browsed prompts.
- **Skeleton / MarketplaceSkeletons** (`src/components/Skeleton.tsx`, `src/components/MarketplaceSkeletons.tsx`): Loading skeleton placeholders.

### 2.3 Checkout, Cart & Bundles
- **Checkout** (`src/components/Checkout.tsx`): Purchase checkout modal with balance verification.
- **Cart** (`src/components/Cart.tsx`): Shopping cart slide-out drawer.
- **BundleCard** (`src/components/BundleCard.tsx`): Bundle package showcase with savings calculation.
- **BundleLibraryCard** (`src/components/BundleLibraryCard.tsx`): Purchased bundle library view.
- **BundleModal** (`src/components/BundleModal.tsx`): Detailed bundle inspector modal.
- **UnlockExplainer** (`src/components/UnlockExplainer.tsx`): Visual explanation of challenge-response unlock flow.
- **TipButton** (`src/components/TipButton.tsx`): Creator tipping widget with preset XLM amounts.
- **GiftPrompt** (`src/components/GiftPrompt.tsx`): Transfer purchase rights to a recipient Stellar address.
- **CopyButton** (`src/components/CopyButton.tsx`): Clipboard copy button with animated success check.
- **ShareLinkButton** (`src/components/ShareLinkButton.tsx`): Social share URL generator.
- **SocialShareButtons** (`src/components/SocialShareButtons.tsx`): One-click sharing to Twitter, Telegram, LinkedIn.
- **PostVersionUpdate** (`src/components/PostVersionUpdate.tsx`): Prompt version release changelog modal.

### 2.4 Creator & Selling
- **CreatorDashboard** (`src/components/sell/CreatorDashboard.tsx`): Analytics, active listings, and revenue metrics.
- **CreatorOnboarding** (`src/components/sell/CreatorOnboarding.tsx`): Guided 3-step creator setup.
- **ListingQualityChecklist** (`src/components/sell/ListingQualityChecklist.tsx`): Real-time pre-publish audit checklist.
- **PrivacyLinterPanel** (`src/components/sell/PrivacyLinterPanel.tsx`): Automated PII and secret leak scanner.

### 2.5 Wallet & Stellar Infrastructure
- **WalletButton** (`src/components/WalletButton.tsx`): Wallet connection state trigger and network badge.
- **ConnectAccount** (`src/components/ConnectAccount.tsx`): Stellar Wallets Kit connection modal.
- **DisplayWallet** (`src/components/DisplayWallet.tsx`): Wallet address formatter and XLM balance badge.
- **StellarAddressInput** (`src/components/StellarAddressInput.tsx`): Validated G... address input field.
- **FundAccountButton** (`src/components/FundAccountButton.tsx`): Testnet Friendbot auto-faucet trigger.
- **NetworkPill** (`src/components/NetworkPill.tsx`): Connected network indicator.
- **NetworkMismatchBanner** (`src/components/NetworkMismatchBanner.tsx`): Network desync warning banner.
- **FeeEstimateBanner** (`src/components/FeeEstimateBanner.tsx`): Gas fee estimate and congestion indicator.

### 2.6 Transaction Feedback
- **TransactionStatusBanner** (`src/components/transaction-feedback/TransactionStatusBanner.tsx`): Multi-state status banner.
- **TransactionSpinner** (`src/components/transaction-feedback/TransactionSpinner.tsx`): Accessible SVG loading spinner.
- **TransactionTimeline** (`src/components/transaction-feedback/TransactionTimeline.tsx`): Step-by-step transaction lifecycle timeline.
- **TransactionErrorBanner** (`src/components/transaction-feedback/TransactionErrorBanner.tsx`): Error triage card with action buttons.
- **TransactionRetryButton** (`src/components/transaction-feedback/TransactionRetryButton.tsx`): Auto-backoff retry trigger.
- **TransactionProgress** (`src/components/TransactionProgress.tsx`): Linear transaction progress indicator.
- **StatusBanner** (`src/components/StatusBanner.tsx`): General contextual status message.
- **AnimatedCheckmark** (`src/components/AnimatedCheckmark.tsx`): SVG animated success checkmark.

### 2.7 Dashboard, Reviews & Navigation
- **TransactionHistoryPanel** (`src/components/dashboard/TransactionHistoryPanel.tsx`): On-chain transaction ledger table.
- **MarketplaceAnalyticsCards** (`src/components/analytics/MarketplaceAnalyticsCards.tsx`): Revenue, sales, and listing metrics.
- **AuditLogViewer** (`src/components/moderation/AuditLogViewer.tsx`): Administrative moderation audit log table.
- **NotificationCenter** (`src/components/NotificationCenter.tsx`): User alerts and notification popover.
- **NotificationPreferences** (`src/components/NotificationPreferences.tsx`): Granular alert settings.
- **WebhookSettings** (`src/components/WebhookSettings.tsx`): Webhook endpoint and HMAC secret configuration.
- **WebhookSubscriptions** (`src/components/webhooks/WebhookSubscriptions.tsx`): Subscriptions console tab — wallet-scoped endpoint table with register / update / delete and a one-time signing-secret reveal.
- **SEOHead** (`src/components/seo/SEOHead.tsx`): Meta tag and OpenGraph previewer.
- **SEOControlsForm** (`src/components/seo/SEOControlsForm.tsx`): Metadata customization form.
- **ReviewList** (`src/components/prompts/ReviewList.tsx`): Verified purchase user reviews list.
- **ReviewForm** (`src/components/prompts/ReviewForm.tsx`): Rating and review submission form.
- **StarRating** (`src/components/prompts/StarRating.tsx`): Interactive 5-star rating widget.
- **ThemeToggle** (`src/components/ThemeToggle.tsx`): Light / Dark / System theme switcher.
- **LanguageSwitcher** (`src/components/LanguageSwitcher.tsx`): Internationalization locale selector.
- **GuessTheNumber** (`src/components/GuessTheNumber.tsx`): Interactive novelty mini-game.

---

## 3. Accessibility & Design Tokens

- **Color Contrast**: All text meets WCAG 2.1 AA contrast ratio ($\ge 4.5:1$ for standard text, $\ge 3:1$ for large headings).
- **Keyboard Navigation**: All interactive elements support focus rings (`focus-visible:ring-1 focus-visible:ring-ring`) and `Enter` / `Space` keyboard actuation.
- **Reduced Motion**: Respects `prefers-reduced-motion` via `ReducedMotionProvider`.
- **Screen Reader Support**: ARIA roles (`role="alert"`, `role="progressbar"`, `aria-expanded`, `aria-live`) on dynamic elements.

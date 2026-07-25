use soroban_sdk::{contracterror, contracttype, Address, Bytes, BytesN, Env, String, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    Unauthorized = 1,
    PromptNotFound = 2,
    CreatorCannotBuy = 3,
    PromptInactive = 4,
    AlreadyPurchased = 5,
    InvalidPrice = 6,
    InvalidFeePercentage = 7,
    InvalidTitleLength = 8,
    InvalidCategoryLength = 9,
    InvalidPreviewLength = 10,
    InvalidEncryptedPromptLength = 11,
    InvalidWrappedKeyLength = 12,
    InvalidImageUrlLength = 13,
    InvalidIvLength = 14,
    FeeWalletNotSet = 15,
    XlmAddressNotSet = 16,
    ArithmeticOverflow = 17,
    ReentrancyGuard = 18,
    ContractIsPaused = 19,
    ReferrerCannotBeBuyerOrCreator = 20,
    InvalidPaymentAmount = 21,
    InvalidVoucher = 22,
    InvalidReferralPercentage = 23,
    InvalidDiscountPercentage = 24,
    MaxSupplyReached = 25,
    InvalidAsset = 26,
    // #50 – revenue splits
    InvalidSplits = 27,
    // #49 – time-bound listing expiry
    ListingExpired = 28,
    LicenseNotFound = 29,
    InvalidLicenseTransfer = 30,
    SubscriptionConfigNotFound = 31,
    SubscriptionInactive = 32,
    InvalidSubscriptionDuration = 33,
    InvalidSubscriptionPrice = 34,
    SubscriptionNotFound = 35,
    ListingNotEligible = 36,
    // #131 – content classification
    InvalidClassification = 37,
    InvalidDisclosureFlags = 38,
    InvalidContentFlagsLength = 39,
    ClassificationAlreadyReviewed = 40,
    NotModerator = 41,
    InvalidSafetyFlagsLength = 42,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Prompt(u128),
    PromptCounter,
    FeePercentage,
    FeeWallet,
    XlmAddress,
    CreatorPrompts(Address),
    BuyerPrompts(Address),
    Purchase(u128, Address),
    Reentrancy,
    ReferralPercentage,
    IsPaused,
    VoucherKey(u128, BytesN<32>),
    SubscriptionConfig(Address),
    Subscription(Address, Address),
    SubscriptionEligible(u128),
    // #131 – content classification
    ClassificationOverride(u128),
    ModeratorAddress,
}

/// A moderator-overridden classification that takes precedence
/// over the creator's attested classification for display purposes.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClassificationOverride {
    pub classifier: Address,
    pub classification: String,
    pub safety_flags: Vec<String>,
    pub reason: String,
    pub reviewed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionConfig {
    pub creator: Address,
    pub duration_secs: u64,
    pub price: i128,
    pub asset: Address,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Subscription {
    pub creator: Address,
    pub subscriber: Address,
    /// Exclusive Unix timestamp: access is valid only while `now < expires_at`.
    pub expires_at: u64,
    pub renewal_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Purchase {
    pub prompt_id: u128,
    pub original_creator: Address,
    pub owner: Address,
    pub original_price: i128,
    pub last_transfer_price: i128,
    pub transfer_count: u32,
    pub last_transferred_at: u64,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PricingConfig {
    pub price: i128,
    pub asset: Address,
}

/// A single revenue-split entry stored inside a prompt.
/// `bps` is the share of the full payment (in basis points) paid to `recipient`
/// before the creator receives the remainder.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Split {
    pub recipient: Address,
    pub bps: u32,
}

/// Full listing configuration passed to create_prompt.
/// Bundles pricing, optional expiry, and optional revenue splits into a single
/// parameter so the function stays within Soroban's 10-parameter limit.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ListingConfig {
    pub price: i128,
    pub asset: Address,
    /// Unix timestamp after which the listing can no longer be purchased.
    /// `0` means the listing never expires.
    pub expires_at: u64,
    /// Optional co-creator revenue splits (empty Vec = no splits).
    pub splits: Vec<Split>,
}

/// Canonical taxonomy for content classification.
/// Creators attest one of these categories for each listing.
/// Uses `None` variant as default (unnamed).
pub const CLASSIFICATION_GENERAL: &str = "general";
pub const CLASSIFICATION_EDUCATIONAL: &str = "educational";
pub const CLASSIFICATION_PROFESSIONAL: &str = "professional";
pub const CLASSIFICATION_CREATIVE: &str = "creative";
pub const CLASSIFICATION_TECHNICAL: &str = "technical";
pub const CLASSIFICATION_SENSITIVE: &str = "sensitive";
pub const CLASSIFICATION_RESTRICTED: &str = "restricted";

pub const ALL_CLASSIFICATIONS: &[&str] = &[
    CLASSIFICATION_GENERAL,
    CLASSIFICATION_EDUCATIONAL,
    CLASSIFICATION_PROFESSIONAL,
    CLASSIFICATION_CREATIVE,
    CLASSIFICATION_TECHNICAL,
    CLASSIFICATION_SENSITIVE,
    CLASSIFICATION_RESTRICTED,
];

/// Standard safety disclosure flags recognized by the platform.
/// Canonical values: "none", "ai-generated", "financial-advice", "medical", "legal", "political"
pub const VALID_DISCLOSURE_FLAGS: &[&str] = &[
    "none",
    "ai-generated",
    "financial-advice",
    "medical",
    "legal",
    "political",
];

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Prompt {
    pub id: u128,
    pub creator: Address,
    pub image_url: String,
    pub title: String,
    pub category: String,
    pub preview_text: String,
    pub encrypted_prompt: String,
    pub encryption_iv: String,
    pub wrapped_key: String,
    pub content_hash: BytesN<32>,
    pub price_stroops: i128,
    pub asset: Address,
    pub active: bool,
    pub sales_count: u64,
    pub max_supply: u64,
    /// Unix timestamp after which the listing can no longer be purchased.
    /// `0` means the listing never expires.
    pub expires_at: u64,
    /// Optional co-creator revenue splits applied against the full payment.
    pub splits: Vec<Split>,
    /// #131 – content classification attested by the creator
    pub classification: String,
    /// #131 – safety disclosure flags attested by the creator
    pub safety_flags: Vec<String>,
}

pub trait PromptHashTrait {
    fn __constructor(
        env: Env,
        admin: Address,
        fee_wallet: Address,
        xlm_sac: Address,
    ) -> Result<(), Error>;

    #[allow(clippy::too_many_arguments)]
    fn create_prompt(
        env: Env,
        creator: Address,
        image_url: String,
        title: String,
        category: String,
        preview_text: String,
        encrypted_prompt: String,
        encryption_iv: String,
        wrapped_key: String,
        content_hash: BytesN<32>,
        listing: ListingConfig,
    ) -> Result<u128, Error>;

    fn set_prompt_sale_status(
        env: Env,
        creator: Address,
        prompt_id: u128,
        active: bool,
    ) -> Result<(), Error>;

    fn set_prompt_max_supply(
        env: Env,
        creator: Address,
        prompt_id: u128,
        max_supply: u64,
    ) -> Result<(), Error>;

    fn update_prompt_price(
        env: Env,
        creator: Address,
        prompt_id: u128,
        price_stroops: i128,
    ) -> Result<(), Error>;

    fn buy_prompt(
        env: Env,
        buyer: Address,
        prompt_id: u128,
        referrer: Option<Address>,
        payment_amount_stroops: i128,
        voucher: Option<Bytes>,
    ) -> Result<(), Error>;

    fn lease_prompt(
        env: Env,
        buyer: Address,
        prompt_id: u128,
        lease_duration_secs: u64,
    ) -> Result<(), Error>;

    /// Push the expiry date of a listing forward. `new_expires_at` must be
    /// strictly greater than the current ledger timestamp.
    fn extend_listing(
        env: Env,
        creator: Address,
        prompt_id: u128,
        new_expires_at: u64,
    ) -> Result<(), Error>;

    /// Purchase multiple prompts atomically in a single transaction.
    /// `prompt_ids` and `payment_amounts` must have equal length.
    /// An optional `referrer` applies to every prompt in the batch.
    /// If any individual purchase fails the entire transaction reverts.
    fn buy_prompts_bulk(
        env: Env,
        buyer: Address,
        prompt_ids: Vec<u128>,
        payment_amounts: Vec<i128>,
        referrer: Option<Address>,
    ) -> Result<(), Error>;

    fn transfer_license(
        env: Env,
        seller: Address,
        prompt_id: u128,
        new_buyer: Address,
        resale_price: i128,
    ) -> Result<(), Error>;

    fn has_access(env: Env, user: Address, prompt_id: u128) -> Result<bool, Error>;
    fn get_prompt(env: Env, prompt_id: u128) -> Result<Prompt, Error>;
    fn get_all_prompts(env: Env) -> Result<Vec<Prompt>, Error>;
    fn get_prompts_by_creator(env: Env, creator: Address) -> Result<Vec<Prompt>, Error>;
    fn get_prompts_by_buyer(env: Env, buyer: Address) -> Result<Vec<Prompt>, Error>;
    fn configure_subscription_pass(
        env: Env,
        creator: Address,
        duration_secs: u64,
        price: i128,
        asset: Address,
        active: bool,
    ) -> Result<(), Error>;
    fn set_subscription_eligibility(
        env: Env,
        creator: Address,
        prompt_id: u128,
        eligible: bool,
    ) -> Result<(), Error>;
    fn subscribe_catalog(
        env: Env,
        subscriber: Address,
        creator: Address,
        payment_amount: i128,
    ) -> Result<u64, Error>;
    fn renew_catalog_subscription(
        env: Env,
        subscriber: Address,
        creator: Address,
        payment_amount: i128,
    ) -> Result<u64, Error>;
    fn get_subscription(
        env: Env,
        subscriber: Address,
        creator: Address,
    ) -> Result<Subscription, Error>;
    fn get_subscription_config(env: Env, creator: Address) -> Result<SubscriptionConfig, Error>;
    fn is_subscription_eligible(env: Env, prompt_id: u128) -> Result<bool, Error>;
    fn set_fee_percentage(env: Env, new_fee_percentage: u32) -> Result<(), Error>;
    fn set_fee_wallet(env: Env, new_fee_wallet: Address) -> Result<(), Error>;
    fn get_fee_percentage(env: Env) -> u32;
    fn get_fee_wallet(env: Env) -> Option<Address>;
    fn set_referral_percentage(env: Env, new_referral_percentage: u32) -> Result<(), Error>;
    fn get_referral_percentage(env: Env) -> u32;
    fn set_pause_status(env: Env, paused: bool) -> Result<(), Error>;
    fn is_paused(env: Env) -> bool;
    fn add_voucher(
        env: Env,
        creator: Address,
        prompt_id: u128,
        hashed_code: BytesN<32>,
        discount_bps: u32,
    ) -> Result<(), Error>;
    fn remove_voucher(
        env: Env,
        creator: Address,
        prompt_id: u128,
        hashed_code: BytesN<32>,
    ) -> Result<(), Error>;
    fn get_xlm_sac(env: Env) -> Option<Address>;
    fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error>;
    fn extend_ttl(env: Env, key: DataKey) -> Result<(), Error>;

    // #131 – content classification
    fn set_classification(
        env: Env,
        creator: Address,
        prompt_id: u128,
        classification: String,
        safety_flags: Vec<String>,
    ) -> Result<(), Error>;
    fn get_classification(env: Env, prompt_id: u128) -> Result<(String, Vec<String>), Error>;
    fn set_moderator_override(
        env: Env,
        moderator: Address,
        prompt_id: u128,
        classification: String,
        safety_flags: Vec<String>,
        reason: String,
    ) -> Result<(), Error>;
    fn get_active_classification(env: Env, prompt_id: u128) -> Result<(String, Vec<String>), Error>;
    fn get_moderator_override(env: Env, prompt_id: u128) -> Result<ClassificationOverride, Error>;
    fn set_moderator_address(env: Env, admin: Address, moderator: Address) -> Result<(), Error>;
}

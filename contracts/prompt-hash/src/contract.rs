use super::events::Events;
use super::storage::Storage;
use super::types::{
    ALL_CLASSIFICATIONS, DataKey, Error, ListingConfig, ClassificationOverride, Prompt,
    PromptHashTrait, Split, Subscription, SubscriptionConfig, VALID_DISCLOSURE_FLAGS,
};
use soroban_sdk::{contract, contractimpl, token, Address, Bytes, BytesN, Env, String, Vec};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_macros::{default_impl, only_owner};

const DEFAULT_FEE_BPS: u32 = 500;
const ROYALTY_BPS: u32 = 500;
const MAX_BPS: u32 = 10_000;
const MAX_TITLE_LEN: u32 = 120;
const MAX_CATEGORY_LEN: u32 = 40;
const MAX_PREVIEW_LEN: u32 = 280;
const MAX_ENCRYPTED_PROMPT_LEN: u32 = 4096;
const MAX_WRAPPED_KEY_LEN: u32 = 256;
const MAX_IMAGE_URL_LEN: u32 = 512;
const MAX_IV_LEN: u32 = 64;
const LEASE_PRICE_BPS: u32 = 4_000;
const MAX_ACCESS_EXPIRY: u64 = u64::MAX;
const MAX_SUBSCRIPTION_DURATION_SECS: u64 = 31_536_000;
const MAX_CLASSIFICATION_LEN: u32 = 20;
const MAX_SAFETY_FLAGS_COUNT: u32 = 10;
const MAX_FLAG_LEN: u32 = 30;
const MAX_REASON_LEN: u32 = 256;

#[contract]
pub struct PromptHashContract;

#[contractimpl]
impl PromptHashTrait for PromptHashContract {
    fn __constructor(
        env: Env,
        admin: Address,
        fee_wallet: Address,
        xlm_sac: Address,
    ) -> Result<(), Error> {
        ownable::set_owner(&env, &admin);
        Storage::set_fee_wallet(&env, &fee_wallet);
        Storage::set_fee_percentage(&env, &DEFAULT_FEE_BPS);
        Storage::set_xlm_address(&env, &xlm_sac);
        Storage::set_pause_status(&env, false);
        env.storage().instance().extend_ttl(
            super::storage::PERSISTENT_LIFETIME_THRESHOLD,
            super::storage::PERSISTENT_BUMP_AMOUNT,
        );
        Ok(())
    }

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
    ) -> Result<u128, Error> {
        creator.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        validate_prompt_fields(
            &image_url,
            &title,
            &category,
            &preview_text,
            &encrypted_prompt,
            &encryption_iv,
            &wrapped_key,
            listing.price,
        )?;

        // Validate that the asset address implements the token interface
        token::Client::new(&env, &listing.asset).decimals();

        // #49: optional listing expiry must be in the future when provided
        if listing.expires_at != 0 {
            ensure(
                listing.expires_at > env.ledger().timestamp(),
                Error::InvalidPrice,
            )?;
        }

        // #50: validate revenue splits
        validate_splits(&env, &listing.splits)?;

        // #131: default classification
        let classification = String::from_str(&env, "general");
        let safety_flags: Vec<String> = Vec::new(&env);

        let prompt_id = Storage::get_prompt_counter(&env);
        let prompt = Prompt {
            id: prompt_id,
            creator: creator.clone(),
            image_url,
            title,
            category,
            preview_text,
            encrypted_prompt,
            encryption_iv,
            wrapped_key,
            content_hash,
            price_stroops: listing.price,
            asset: listing.asset.clone(),
            active: true,
            sales_count: 0,
            max_supply: 0,
            expires_at: listing.expires_at,
            splits: listing.splits,
            classification,
            safety_flags,
        };

        Storage::save_prompt(&env, &prompt)?;
        Storage::add_prompt_to_creator(&env, &creator, prompt_id);
        Events::emit_prompt_created(&env, prompt_id, creator, listing.price, listing.asset);
        Ok(prompt_id)
    }

    fn set_prompt_sale_status(
        env: Env,
        creator: Address,
        prompt_id: u128,
        active: bool,
    ) -> Result<(), Error> {
        creator.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        let mut prompt = Storage::require_prompt(&env, prompt_id)?;
        ensure(prompt.creator == creator, Error::Unauthorized)?;

        prompt.active = active;
        Storage::update_prompt(&env, &prompt);
        Events::emit_prompt_sale_status_updated(&env, prompt_id, active);
        Ok(())
    }

    fn set_prompt_max_supply(
        env: Env,
        creator: Address,
        prompt_id: u128,
        max_supply: u64,
    ) -> Result<(), Error> {
        creator.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        let mut prompt = Storage::require_prompt(&env, prompt_id)?;
        ensure(prompt.creator == creator, Error::Unauthorized)?;
        prompt.max_supply = max_supply;
        Storage::update_prompt(&env, &prompt);
        Ok(())
    }

    fn update_prompt_price(
        env: Env,
        creator: Address,
        prompt_id: u128,
        price_stroops: i128,
    ) -> Result<(), Error> {
        creator.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        ensure(price_stroops > 0, Error::InvalidPrice)?;

        let mut prompt = Storage::require_prompt(&env, prompt_id)?;
        ensure(prompt.creator == creator, Error::Unauthorized)?;
        prompt.price_stroops = price_stroops;

        Storage::update_prompt(&env, &prompt);
        Events::emit_prompt_price_updated(&env, prompt_id, price_stroops);
        Ok(())
    }

    fn buy_prompt(
        env: Env,
        buyer: Address,
        prompt_id: u128,
        referrer: Option<Address>,
        payment_amount_stroops: i128,
        voucher: Option<Bytes>,
    ) -> Result<(), Error> {
        buyer.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        execute_buy(
            &env,
            &buyer,
            prompt_id,
            &referrer,
            payment_amount_stroops,
            voucher,
        )
    }

    fn lease_prompt(
        env: Env,
        buyer: Address,
        prompt_id: u128,
        lease_duration_secs: u64,
    ) -> Result<(), Error> {
        buyer.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        let mut prompt = Storage::require_prompt(&env, prompt_id)?;
        let now = env.ledger().timestamp();

        ensure(prompt.active, Error::PromptInactive)?;
        ensure(prompt.creator != buyer, Error::CreatorCannotBuy)?;
        ensure(lease_duration_secs > 0, Error::InvalidPrice)?;
        ensure(
            !Storage::has_active_purchase(&env, prompt_id, &buyer, now),
            Error::AlreadyPurchased,
        )?;

        // #49: block purchase on expired listing
        if prompt.expires_at != 0 {
            ensure(prompt.expires_at >= now, Error::ListingExpired)?;
        }

        Storage::set_reentrancy_guard(&env)?;

        let fee_wallet = Storage::get_fee_wallet(&env).ok_or(Error::FeeWalletNotSet)?;
        let this_contract = env.current_contract_address();
        let fee_percentage = Storage::get_fee_percentage(&env);
        ensure(fee_percentage <= MAX_BPS, Error::InvalidFeePercentage)?;

        let lease_price = prompt
            .price_stroops
            .checked_mul(LEASE_PRICE_BPS as i128)
            .ok_or(Error::ArithmeticOverflow)?
            / MAX_BPS as i128;
        ensure(lease_price > 0, Error::InvalidPrice)?;

        let fee_amount = lease_price
            .checked_mul(fee_percentage as i128)
            .ok_or(Error::ArithmeticOverflow)?
            / MAX_BPS as i128;
        let seller_amount = lease_price
            .checked_sub(fee_amount)
            .ok_or(Error::ArithmeticOverflow)?;

        let asset_client = token::StellarAssetClient::new(&env, &prompt.asset);
        asset_client.transfer_from(&this_contract, &buyer, &prompt.creator, &seller_amount);
        if fee_amount > 0 {
            asset_client.transfer_from(&this_contract, &buyer, &fee_wallet, &fee_amount);
        }

        prompt.sales_count = prompt
            .sales_count
            .checked_add(1)
            .ok_or(Error::ArithmeticOverflow)?;
        let expires_at = now
            .checked_add(lease_duration_secs)
            .ok_or(Error::ArithmeticOverflow)?;
        Storage::update_prompt(&env, &prompt);
        Storage::grant_purchase(&env, &prompt, &buyer, lease_price, expires_at);
        Storage::clear_reentrancy_guard(&env);
        Events::emit_prompt_purchased(&env, prompt_id, buyer, prompt.creator, lease_price, None);
        Ok(())
    }

    // ─── Issue #49: Time-Bound Listing Expiry ────────────────────────────────

    fn extend_listing(
        env: Env,
        creator: Address,
        prompt_id: u128,
        new_expires_at: u64,
    ) -> Result<(), Error> {
        creator.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        let mut prompt = Storage::require_prompt(&env, prompt_id)?;
        ensure(prompt.creator == creator, Error::Unauthorized)?;

        let now = env.ledger().timestamp();
        ensure(new_expires_at > now, Error::InvalidPrice)?;

        prompt.expires_at = new_expires_at;
        Storage::update_prompt(&env, &prompt);
        Events::emit_listing_extended(&env, prompt_id, new_expires_at);
        Ok(())
    }

    // ─── Issue #51: Bulk Purchase ────────────────────────────────────────────

    fn buy_prompts_bulk(
        env: Env,
        buyer: Address,
        prompt_ids: Vec<u128>,
        payment_amounts: Vec<i128>,
        referrer: Option<Address>,
    ) -> Result<(), Error> {
        buyer.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        ensure(
            prompt_ids.len() == payment_amounts.len(),
            Error::InvalidPrice,
        )?;

        for i in 0..prompt_ids.len() {
            let prompt_id = prompt_ids.get(i).unwrap();
            let payment_amount = payment_amounts.get(i).unwrap();
            execute_buy(&env, &buyer, prompt_id, &referrer, payment_amount, None)?;
        }
        Ok(())
    }

    fn transfer_license(
        env: Env,
        seller: Address,
        prompt_id: u128,
        new_buyer: Address,
        resale_price: i128,
    ) -> Result<(), Error> {
        seller.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        ensure(resale_price > 0, Error::InvalidPaymentAmount)?;
        ensure(seller != new_buyer, Error::InvalidLicenseTransfer)?;
        new_buyer.require_auth();

        let prompt = Storage::require_prompt(&env, prompt_id)?;
        let now = env.ledger().timestamp();
        let mut purchase = Storage::require_purchase(&env, prompt_id, &seller)?;
        ensure(purchase.owner == seller, Error::Unauthorized)?;
        ensure(purchase.expires_at >= now, Error::LicenseNotFound)?;
        ensure(
            !Storage::has_active_purchase(&env, prompt_id, &new_buyer, now),
            Error::AlreadyPurchased,
        )?;

        Storage::set_reentrancy_guard(&env)?;

        let this_contract = env.current_contract_address();
        let asset_client = token::StellarAssetClient::new(&env, &prompt.asset);
        let royalty_amount = resale_price
            .checked_mul(ROYALTY_BPS as i128)
            .ok_or(Error::ArithmeticOverflow)?
            / MAX_BPS as i128;
        let seller_amount = resale_price
            .checked_sub(royalty_amount)
            .ok_or(Error::ArithmeticOverflow)?;

        if royalty_amount > 0 {
            asset_client.transfer_from(
                &this_contract,
                &new_buyer,
                &purchase.original_creator,
                &royalty_amount,
            );
        }
        if seller_amount > 0 {
            asset_client.transfer_from(&this_contract, &new_buyer, &seller, &seller_amount);
        }

        Storage::remove_purchase(&env, prompt_id, &seller);
        Storage::remove_prompt_from_buyer(&env, &seller, prompt_id);
        purchase.owner = new_buyer.clone();
        purchase.last_transfer_price = resale_price;
        purchase.transfer_count = purchase
            .transfer_count
            .checked_add(1)
            .ok_or(Error::ArithmeticOverflow)?;
        purchase.last_transferred_at = now;
        Storage::save_purchase(&env, &purchase);
        Storage::add_prompt_to_buyer(&env, &new_buyer, prompt_id);
        Storage::clear_reentrancy_guard(&env);

        Events::emit_license_transferred(
            &env,
            prompt_id,
            seller,
            new_buyer,
            purchase.original_creator,
            resale_price,
            royalty_amount,
        );
        Ok(())
    }

    fn has_access(env: Env, user: Address, prompt_id: u128) -> Result<bool, Error> {
        let prompt = Storage::require_prompt(&env, prompt_id)?;
        let now = env.ledger().timestamp();
        if prompt.creator == user || Storage::has_active_purchase(&env, prompt_id, &user, now) {
            return Ok(true);
        }
        if !Storage::is_subscription_eligible(&env, prompt_id) {
            return Ok(false);
        }
        Ok(Storage::get_subscription(&env, &user, &prompt.creator)
            .map(|subscription| now < subscription.expires_at)
            .unwrap_or(false))
    }

    fn get_prompt(env: Env, prompt_id: u128) -> Result<Prompt, Error> {
        Storage::require_prompt(&env, prompt_id)
    }

    fn get_all_prompts(env: Env) -> Result<Vec<Prompt>, Error> {
        Ok(Storage::get_all_prompts(&env))
    }

    fn get_prompts_by_creator(env: Env, creator: Address) -> Result<Vec<Prompt>, Error> {
        Ok(Storage::get_prompts_by_creator(&env, &creator))
    }

    fn get_prompts_by_buyer(env: Env, buyer: Address) -> Result<Vec<Prompt>, Error> {
        Ok(Storage::get_prompts_by_buyer(&env, &buyer))
    }

    fn configure_subscription_pass(
        env: Env,
        creator: Address,
        duration_secs: u64,
        price: i128,
        asset: Address,
        active: bool,
    ) -> Result<(), Error> {
        creator.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        ensure(
            duration_secs > 0 && duration_secs <= MAX_SUBSCRIPTION_DURATION_SECS,
            Error::InvalidSubscriptionDuration,
        )?;
        ensure(price > 0, Error::InvalidSubscriptionPrice)?;
        token::Client::new(&env, &asset).decimals();
        Storage::save_subscription_config(
            &env,
            &SubscriptionConfig {
                creator: creator.clone(),
                duration_secs,
                price,
                asset: asset.clone(),
                active,
            },
        );
        Events::emit_subscription_configured(&env, creator, duration_secs, price, asset, active);
        Ok(())
    }

    fn set_subscription_eligibility(
        env: Env,
        creator: Address,
        prompt_id: u128,
        eligible: bool,
    ) -> Result<(), Error> {
        creator.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        let prompt = Storage::require_prompt(&env, prompt_id)?;
        ensure(prompt.creator == creator, Error::Unauthorized)?;
        Storage::set_subscription_eligibility(&env, prompt_id, eligible);
        Events::emit_subscription_eligibility_updated(&env, prompt_id, eligible);
        Ok(())
    }

    fn subscribe_catalog(
        env: Env,
        subscriber: Address,
        creator: Address,
        payment_amount: i128,
    ) -> Result<u64, Error> {
        subscriber.require_auth();
        ensure(
            Storage::get_subscription(&env, &subscriber, &creator).is_none(),
            Error::AlreadyPurchased,
        )?;
        settle_subscription(&env, &subscriber, &creator, payment_amount, false)
    }

    fn renew_catalog_subscription(
        env: Env,
        subscriber: Address,
        creator: Address,
        payment_amount: i128,
    ) -> Result<u64, Error> {
        subscriber.require_auth();
        settle_subscription(&env, &subscriber, &creator, payment_amount, true)
    }

    fn get_subscription(
        env: Env,
        subscriber: Address,
        creator: Address,
    ) -> Result<Subscription, Error> {
        Storage::get_subscription(&env, &subscriber, &creator).ok_or(Error::SubscriptionNotFound)
    }

    fn get_subscription_config(env: Env, creator: Address) -> Result<SubscriptionConfig, Error> {
        Storage::get_subscription_config(&env, &creator).ok_or(Error::SubscriptionConfigNotFound)
    }

    fn is_subscription_eligible(env: Env, prompt_id: u128) -> Result<bool, Error> {
        Storage::require_prompt(&env, prompt_id)?;
        Ok(Storage::is_subscription_eligible(&env, prompt_id))
    }

    #[only_owner]
    fn set_fee_percentage(env: Env, new_fee_percentage: u32) -> Result<(), Error> {
        ensure(new_fee_percentage <= MAX_BPS, Error::InvalidFeePercentage)?;
        Storage::set_fee_percentage(&env, &new_fee_percentage);
        Events::emit_fee_updated(&env, new_fee_percentage);
        Ok(())
    }

    #[only_owner]
    fn set_fee_wallet(env: Env, new_fee_wallet: Address) -> Result<(), Error> {
        Storage::set_fee_wallet(&env, &new_fee_wallet);
        Events::emit_fee_wallet_updated(&env, new_fee_wallet);
        Ok(())
    }

    fn get_fee_percentage(env: Env) -> u32 {
        Storage::get_fee_percentage(&env)
    }

    fn get_fee_wallet(env: Env) -> Option<Address> {
        Storage::get_fee_wallet(&env)
    }

    fn get_xlm_sac(env: Env) -> Option<Address> {
        Storage::get_xlm_address(&env)
    }

    #[only_owner]
    fn set_pause_status(env: Env, paused: bool) -> Result<(), Error> {
        Storage::set_pause_status(&env, paused);
        Events::emit_contract_paused_state_changed(&env, paused);
        Ok(())
    }

    fn is_paused(env: Env) -> bool {
        Storage::is_paused(&env)
    }

    #[only_owner]
    fn set_referral_percentage(env: Env, new_referral_percentage: u32) -> Result<(), Error> {
        ensure(
            new_referral_percentage <= MAX_BPS,
            Error::InvalidReferralPercentage,
        )?;
        Storage::set_referral_percentage(&env, new_referral_percentage);
        Ok(())
    }

    fn get_referral_percentage(env: Env) -> u32 {
        Storage::get_referral_percentage(&env)
    }

    fn add_voucher(
        env: Env,
        creator: Address,
        prompt_id: u128,
        hashed_code: BytesN<32>,
        discount_bps: u32,
    ) -> Result<(), Error> {
        creator.require_auth();
        ensure(discount_bps <= MAX_BPS, Error::InvalidDiscountPercentage)?;
        let prompt = Storage::require_prompt(&env, prompt_id)?;
        ensure(prompt.creator == creator, Error::Unauthorized)?;

        Storage::add_voucher(&env, prompt_id, &hashed_code, discount_bps);
        Events::emit_voucher_added(&env, prompt_id, hashed_code, discount_bps);
        Ok(())
    }

    fn remove_voucher(
        env: Env,
        creator: Address,
        prompt_id: u128,
        hashed_code: BytesN<32>,
    ) -> Result<(), Error> {
        creator.require_auth();
        let prompt = Storage::require_prompt(&env, prompt_id)?;
        ensure(prompt.creator == creator, Error::Unauthorized)?;

        Storage::remove_voucher(&env, prompt_id, &hashed_code);
        Events::emit_voucher_removed(&env, prompt_id, hashed_code);
        Ok(())
    }

    #[only_owner]
    fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        env.storage().instance().extend_ttl(
            super::storage::PERSISTENT_LIFETIME_THRESHOLD,
            super::storage::PERSISTENT_BUMP_AMOUNT,
        );
        Ok(())
    }

    fn extend_ttl(env: Env, key: DataKey) -> Result<(), Error> {
        Storage::extend_key_ttl(&env, &key);
        Ok(())
    }

    // ─── #131: Content Classification ──────────────────────────────────────

    fn set_classification(
        env: Env,
        creator: Address,
        prompt_id: u128,
        classification: String,
        safety_flags: Vec<String>,
    ) -> Result<(), Error> {
        creator.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        let mut prompt = Storage::require_prompt(&env, prompt_id)?;
        ensure(prompt.creator == creator, Error::Unauthorized)?;
        validate_classification(&env, &classification)?;
        validate_safety_flags(&env, &safety_flags)?;

        prompt.classification = classification.clone();
        prompt.safety_flags = safety_flags.clone();
        Storage::update_prompt(&env, &prompt);
        Events::emit_classification_set(&env, prompt_id, classification, safety_flags);
        Ok(())
    }

    fn get_classification(env: Env, prompt_id: u128) -> Result<(String, Vec<String>), Error> {
        let prompt = Storage::require_prompt(&env, prompt_id)?;
        Ok((prompt.classification, prompt.safety_flags))
    }

    fn set_moderator_override(
        env: Env,
        moderator: Address,
        prompt_id: u128,
        classification: String,
        safety_flags: Vec<String>,
        reason: String,
    ) -> Result<(), Error> {
        moderator.require_auth();
        ensure(!Storage::is_paused(&env), Error::ContractIsPaused)?;
        let stored_moderator = Storage::get_moderator_address(&env)
            .ok_or(Error::NotModerator)?;
        ensure(moderator == stored_moderator, Error::NotModerator)?;
        ensure(!reason.is_empty() && reason.len() <= MAX_REASON_LEN, Error::InvalidClassification)?;
        validate_classification(&env, &classification)?;
        validate_safety_flags(&env, &safety_flags)?;

        let now = env.ledger().timestamp();
        let override_entry = ClassificationOverride {
            classifier: moderator.clone(),
            classification: classification.clone(),
            safety_flags: safety_flags.clone(),
            reason: reason.clone(),
            reviewed_at: now,
        };
        Storage::set_moderator_override(&env, prompt_id, &override_entry);
        Events::emit_classification_overridden(
            &env, prompt_id, moderator, classification, safety_flags, reason,
        );
        Ok(())
    }

    fn get_active_classification(env: Env, prompt_id: u128) -> Result<(String, Vec<String>), Error> {
        let prompt = Storage::require_prompt(&env, prompt_id)?;
        // Moderator override takes precedence if it exists
        if let Some(override_entry) = Storage::get_moderator_override(&env, prompt_id) {
            return Ok((override_entry.classification, override_entry.safety_flags));
        }
        Ok((prompt.classification, prompt.safety_flags))
    }

    fn get_moderator_override(env: Env, prompt_id: u128) -> Result<ClassificationOverride, Error> {
        Storage::get_moderator_override(&env, prompt_id).ok_or(Error::PromptNotFound)
    }

    #[only_owner]
    fn set_moderator_address(env: Env, admin: Address, moderator: Address) -> Result<(), Error> {
        admin.require_auth();
        Storage::set_moderator_address(&env, &moderator);
        Ok(())
    }
}

#[default_impl]
#[contractimpl]
impl Ownable for PromptHashContract {}

// ─── Core buy logic (shared by buy_prompt and buy_prompts_bulk) ──────────────

fn settle_subscription(
    env: &Env,
    subscriber: &Address,
    creator: &Address,
    payment_amount: i128,
    renewal: bool,
) -> Result<u64, Error> {
    ensure(!Storage::is_paused(env), Error::ContractIsPaused)?;
    ensure(subscriber != creator, Error::CreatorCannotBuy)?;
    let config =
        Storage::get_subscription_config(env, creator).ok_or(Error::SubscriptionConfigNotFound)?;
    ensure(config.active, Error::SubscriptionInactive)?;
    ensure(
        payment_amount == config.price,
        Error::InvalidSubscriptionPrice,
    )?;

    let existing = Storage::get_subscription(env, subscriber, creator);
    if renewal {
        ensure(existing.is_some(), Error::SubscriptionNotFound)?;
    }

    Storage::set_reentrancy_guard(env)?;
    let fee_wallet = Storage::get_fee_wallet(env).ok_or(Error::FeeWalletNotSet)?;
    let fee_bps = Storage::get_fee_percentage(env);
    ensure(fee_bps <= MAX_BPS, Error::InvalidFeePercentage)?;
    let platform_amount = payment_amount
        .checked_mul(fee_bps as i128)
        .ok_or(Error::ArithmeticOverflow)?
        / MAX_BPS as i128;
    let creator_amount = payment_amount
        .checked_sub(platform_amount)
        .ok_or(Error::ArithmeticOverflow)?;
    let this_contract = env.current_contract_address();
    let asset_client = token::StellarAssetClient::new(env, &config.asset);
    if creator_amount > 0 {
        asset_client.transfer_from(&this_contract, subscriber, creator, &creator_amount);
    }
    if platform_amount > 0 {
        asset_client.transfer_from(&this_contract, subscriber, &fee_wallet, &platform_amount);
    }

    let now = env.ledger().timestamp();
    let base = existing
        .as_ref()
        .map(|subscription| subscription.expires_at.max(now))
        .unwrap_or(now);
    let expires_at = base
        .checked_add(config.duration_secs)
        .ok_or(Error::ArithmeticOverflow)?;
    let renewal_count = existing
        .map(|subscription| subscription.renewal_count)
        .unwrap_or(0)
        .checked_add(if renewal { 1 } else { 0 })
        .ok_or(Error::ArithmeticOverflow)?;
    Storage::save_subscription(
        env,
        &Subscription {
            creator: creator.clone(),
            subscriber: subscriber.clone(),
            expires_at,
            renewal_count,
        },
    );
    Storage::clear_reentrancy_guard(env);
    Events::emit_subscription_renewed(
        env,
        creator.clone(),
        subscriber.clone(),
        expires_at,
        payment_amount,
        renewal_count,
    );
    Ok(expires_at)
}

fn execute_buy(
    env: &Env,
    buyer: &Address,
    prompt_id: u128,
    referrer: &Option<Address>,
    payment_amount_stroops: i128,
    voucher: Option<Bytes>,
) -> Result<(), Error> {
    let mut prompt = Storage::require_prompt(env, prompt_id)?;
    let now = env.ledger().timestamp();

    ensure(prompt.active, Error::PromptInactive)?;
    ensure(prompt.creator != *buyer, Error::CreatorCannotBuy)?;
    ensure(
        !Storage::has_active_purchase(env, prompt_id, buyer, now),
        Error::AlreadyPurchased,
    )?;

    // #49: block purchase on an expired listing
    if prompt.expires_at != 0 {
        ensure(prompt.expires_at >= now, Error::ListingExpired)?;
    }

    // Enforce max supply (0 = unlimited)
    if prompt.max_supply > 0 {
        ensure(
            prompt.sales_count < prompt.max_supply,
            Error::MaxSupplyReached,
        )?;
    }

    // Apply voucher discount if provided
    let mut required_price = prompt.price_stroops;
    if let Some(code) = voucher {
        let hashed_raw = env.crypto().sha256(&code);
        let hashed = BytesN::from_array(env, &hashed_raw.to_array());
        if let Some(discount_bps) = Storage::get_voucher(env, prompt_id, &hashed) {
            let discount_amount = required_price
                .checked_mul(discount_bps as i128)
                .ok_or(Error::ArithmeticOverflow)?
                / MAX_BPS as i128;
            required_price = required_price
                .checked_sub(discount_amount)
                .ok_or(Error::ArithmeticOverflow)?;
            Storage::remove_voucher(env, prompt_id, &hashed);
        } else {
            return Err(Error::InvalidVoucher);
        }
    }

    ensure(
        payment_amount_stroops >= required_price,
        Error::InvalidPaymentAmount,
    )?;

    if let Some(ref r) = referrer {
        ensure(
            r != buyer && r != &prompt.creator,
            Error::ReferrerCannotBeBuyerOrCreator,
        )?;
    }

    Storage::set_reentrancy_guard(env)?;

    let fee_wallet = Storage::get_fee_wallet(env).ok_or(Error::FeeWalletNotSet)?;
    let this_contract = env.current_contract_address();

    let fee_percentage = Storage::get_fee_percentage(env);
    ensure(fee_percentage <= MAX_BPS, Error::InvalidFeePercentage)?;

    let fee_amount = payment_amount_stroops
        .checked_mul(fee_percentage as i128)
        .ok_or(Error::ArithmeticOverflow)?
        / MAX_BPS as i128;

    let referral_percentage = Storage::get_referral_percentage(env);
    let referral_amount = if referrer.is_some() {
        payment_amount_stroops
            .checked_mul(referral_percentage as i128)
            .ok_or(Error::ArithmeticOverflow)?
            / MAX_BPS as i128
    } else {
        0
    };

    let deductions = fee_amount
        .checked_add(referral_amount)
        .ok_or(Error::ArithmeticOverflow)?;

    // #50: accumulate split amounts (each split is a share of the full payment)
    let mut split_total: i128 = 0;
    for i in 0..prompt.splits.len() {
        let split = prompt.splits.get(i).unwrap();
        let split_amount = payment_amount_stroops
            .checked_mul(split.bps as i128)
            .ok_or(Error::ArithmeticOverflow)?
            / MAX_BPS as i128;
        split_total = split_total
            .checked_add(split_amount)
            .ok_or(Error::ArithmeticOverflow)?;
    }

    let total_deductions = deductions
        .checked_add(split_total)
        .ok_or(Error::ArithmeticOverflow)?;
    let creator_amount = payment_amount_stroops
        .checked_sub(total_deductions)
        .ok_or(Error::ArithmeticOverflow)?;

    // Guard against misconfigured splits (e.g. fee raised after creation)
    ensure(creator_amount >= 0, Error::InvalidSplits)?;

    let asset_client = token::StellarAssetClient::new(env, &prompt.asset);

    if creator_amount > 0 {
        asset_client.transfer_from(&this_contract, buyer, &prompt.creator, &creator_amount);
    }

    if fee_amount > 0 {
        asset_client.transfer_from(&this_contract, buyer, &fee_wallet, &fee_amount);
    }

    if let Some(ref r) = referrer {
        if referral_amount > 0 {
            asset_client.transfer_from(&this_contract, buyer, r, &referral_amount);
        }
    }

    // #50: distribute co-creator splits
    for i in 0..prompt.splits.len() {
        let split = prompt.splits.get(i).unwrap();
        let split_amount = payment_amount_stroops
            .checked_mul(split.bps as i128)
            .ok_or(Error::ArithmeticOverflow)?
            / MAX_BPS as i128;
        if split_amount > 0 {
            asset_client.transfer_from(&this_contract, buyer, &split.recipient, &split_amount);
        }
    }

    prompt.sales_count = prompt
        .sales_count
        .checked_add(1)
        .ok_or(Error::ArithmeticOverflow)?;
    Storage::update_prompt(env, &prompt);
    Storage::grant_purchase(
        env,
        &prompt,
        buyer,
        payment_amount_stroops,
        MAX_ACCESS_EXPIRY,
    );
    Storage::clear_reentrancy_guard(env);

    Events::emit_prompt_purchased(
        env,
        prompt_id,
        buyer.clone(),
        prompt.creator,
        payment_amount_stroops,
        referrer.clone(),
    );

    if payment_amount_stroops > required_price {
        Events::emit_prompt_tipped(
            env,
            prompt_id,
            buyer.clone(),
            payment_amount_stroops - required_price,
        );
    }

    Ok(())
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/// Validate that the sum of all split basis-points does not exceed
/// MAX_BPS minus the current platform fee, ensuring the creator always
/// receives a non-negative payout.
fn validate_splits(env: &Env, splits: &Vec<Split>) -> Result<(), Error> {
    let fee_percentage = Storage::get_fee_percentage(env);
    let mut total_bps: u32 = 0;
    for i in 0..splits.len() {
        let split = splits.get(i).unwrap();
        ensure(split.bps > 0, Error::InvalidSplits)?;
        total_bps = total_bps
            .checked_add(split.bps)
            .ok_or(Error::ArithmeticOverflow)?;
    }
    // total_bps + fee must not exceed MAX_BPS so creator always gets ≥ 0
    let total = total_bps
        .checked_add(fee_percentage)
        .ok_or(Error::ArithmeticOverflow)?;
    ensure(total <= MAX_BPS, Error::InvalidSplits)?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn validate_prompt_fields(
    image_url: &String,
    title: &String,
    category: &String,
    preview_text: &String,
    encrypted_prompt: &String,
    encryption_iv: &String,
    wrapped_key: &String,
    price_stroops: i128,
) -> Result<(), Error> {
    ensure(price_stroops > 0, Error::InvalidPrice)?;
    validate_len(image_url, MAX_IMAGE_URL_LEN, Error::InvalidImageUrlLength)?;
    validate_len(title, MAX_TITLE_LEN, Error::InvalidTitleLength)?;
    validate_len(category, MAX_CATEGORY_LEN, Error::InvalidCategoryLength)?;
    validate_len(preview_text, MAX_PREVIEW_LEN, Error::InvalidPreviewLength)?;
    validate_len(
        encrypted_prompt,
        MAX_ENCRYPTED_PROMPT_LEN,
        Error::InvalidEncryptedPromptLength,
    )?;
    validate_len(
        wrapped_key,
        MAX_WRAPPED_KEY_LEN,
        Error::InvalidWrappedKeyLength,
    )?;
    validate_len(encryption_iv, MAX_IV_LEN, Error::InvalidIvLength)?;
    Ok(())
}

fn validate_len(value: &String, max_len: u32, error: Error) -> Result<(), Error> {
    ensure(!value.is_empty() && value.len() <= max_len, error)
}

fn ensure(condition: bool, error: Error) -> Result<(), Error> {
    if condition {
        Ok(())
    } else {
        Err(error)
    }
}

// ─── #131: Classification validation helpers ────────────────────────────────

fn validate_classification(env: &Env, classification: &String) -> Result<(), Error> {
    ensure(
        !classification.is_empty() && classification.len() <= MAX_CLASSIFICATION_LEN,
        Error::InvalidClassification,
    )?;
    let mut valid = false;
    for &cat in ALL_CLASSIFICATIONS {
        if &String::from_str(env, cat) == classification {
            valid = true;
            break;
        }
    }
    ensure(valid, Error::InvalidClassification)?;
    Ok(())
}

fn validate_safety_flags(env: &Env, flags: &Vec<String>) -> Result<(), Error> {
    ensure(
        flags.len() <= MAX_SAFETY_FLAGS_COUNT,
        Error::InvalidSafetyFlagsLength,
    )?;
    for i in 0..flags.len() {
        let flag = flags.get(i).unwrap();
        ensure(!flag.is_empty() && flag.len() <= MAX_FLAG_LEN, Error::InvalidDisclosureFlags)?;
        // Allow "none" only as the sole flag
        if flag == String::from_str(env, "none") {
            ensure(flags.len() == 1, Error::InvalidDisclosureFlags)?;
        }
        let is_valid = VALID_DISCLOSURE_FLAGS
            .iter()
            .any(|f| String::from_str(env, f) == flag);
        ensure(is_valid, Error::InvalidDisclosureFlags)?;
    }
    Ok(())
}

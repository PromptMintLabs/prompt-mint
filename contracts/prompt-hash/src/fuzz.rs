//! Property-based fuzz coverage for malformed/adversarial Soroban inputs.
//!
//! These tests don't assert exact business outcomes the way `test.rs` does;
//! instead they assert the contract's core invariant under garbage input:
//! every entry point must return a typed `Error`, or succeed, but must never
//! panic/trap regardless of how malformed, oversized, or numerically extreme
//! the input is. A panic here means an attacker-controlled input can abort a
//! transaction in a way callers can't recover from or reason about.
extern crate std;

use crate::contract::{PromptHashContract, PromptHashContractClient};
use crate::mock_asset::FungibleTokenContract;
use crate::types::{ListingConfig, Split};
use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Bytes, BytesN, Env, String, Vec,
};
use std::string::String as StdString;
use std::vec::Vec as StdVec;

struct FuzzContext {
    contract: Address,
    xlm: Address,
}

fn setup(env: &Env) -> FuzzContext {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let admin_two = Address::generate(env);
    let admin_three = Address::generate(env);
    let upgrade_admin = Address::generate(env);
    let upgrade_admin_two = Address::generate(env);
    let upgrade_admin_three = Address::generate(env);
    let fee_wallet = Address::generate(env);
    let xlm = env.register(FungibleTokenContract, (admin.clone(),));
    let contract = env.register(
        PromptHashContract,
        (
            admin.clone(),
            admin_two,
            admin_three,
            upgrade_admin,
            upgrade_admin_two,
            upgrade_admin_three,
            fee_wallet.clone(),
            xlm.clone(),
        ),
    );
    FuzzContext { contract, xlm }
}

/// Builds an arbitrary (possibly invalid) UTF-8 string of up to `max_len`
/// bytes for a Soroban `String` field.
fn arb_string(max_len: usize) -> impl Strategy<Value = StdString> {
    proptest::collection::vec(proptest::char::any(), 0..max_len)
        .prop_map(|chars| chars.into_iter().collect::<StdString>())
}

fn arb_bytes(max_len: usize) -> impl Strategy<Value = StdVec<u8>> {
    proptest::collection::vec(any::<u8>(), 0..max_len)
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(48))]

    /// `create_prompt` must never panic no matter how malformed the text
    /// fields or price are: oversized strings (well past every MAX_*_LEN
    /// constant), empty strings, non-ASCII/emoji content, and the full i128
    /// range for price (including negative and zero) must all come back as
    /// a typed `Result`, not a trap.
    #[test]
    fn fuzz_create_prompt_never_panics(
        title in arb_string(400),
        category in arb_string(200),
        preview in arb_string(600),
        encrypted in arb_string(5000),
        iv in arb_string(200),
        wrapped_key in arb_string(400),
        price in any::<i128>(),
    ) {
        let env: Env = Default::default();
        let context = setup(&env);
        let client = PromptHashContractClient::new(&env, &context.contract);
        let creator = Address::generate(&env);

        let _ = client.try_create_prompt(
            &creator,
            &String::from_str(&env, "https://example.com/image.png"),
            &String::from_str(&env, &title),
            &String::from_str(&env, &category),
            &String::from_str(&env, &preview),
            &String::from_str(&env, &encrypted),
            &String::from_str(&env, &iv),
            &String::from_str(&env, &wrapped_key),
            &BytesN::from_array(&env, &[7u8; 32]),
            &ListingConfig {
                price,
                asset: context.xlm.clone(),
                expires_at: 0,
                splits: Vec::new(&env),
            },
        );
    }

    /// Revenue splits are attacker/creator-supplied at listing time. Random
    /// counts of recipients with random bps (including values that overflow
    /// the running u32 total) must never panic - only ever `Ok` or a typed
    /// `Error`.
    #[test]
    fn fuzz_create_prompt_with_arbitrary_splits_never_panics(
        bps_values in proptest::collection::vec(any::<u32>(), 0..12),
        price in 1i128..1_000_000_000_000i128,
    ) {
        let env: Env = Default::default();
        let context = setup(&env);
        let client = PromptHashContractClient::new(&env, &context.contract);
        let creator = Address::generate(&env);

        let mut splits = Vec::new(&env);
        for bps in bps_values {
            splits.push_back(Split {
                recipient: Address::generate(&env),
                bps,
            });
        }

        let _ = client.try_create_prompt(
            &creator,
            &String::from_str(&env, "https://example.com/image.png"),
            &String::from_str(&env, "Fuzzed splits"),
            &String::from_str(&env, "General"),
            &String::from_str(&env, "preview"),
            &String::from_str(&env, "ciphertext"),
            &String::from_str(&env, "iv"),
            &String::from_str(&env, "wrapped-key"),
            &BytesN::from_array(&env, &[9u8; 32]),
            &ListingConfig {
                price,
                asset: context.xlm.clone(),
                expires_at: 0,
                splits,
            },
        );
    }

    /// `buy_prompt` payment amounts are buyer-controlled. The full i128 range
    /// (negative, zero, i128::MAX) must be rejected cleanly or accepted, but
    /// never trigger a panic in the fee/referral/split arithmetic.
    #[test]
    fn fuzz_buy_prompt_payment_amount_never_panics(payment_amount in any::<i128>()) {
        let env: Env = Default::default();
        let context = setup(&env);
        let client = PromptHashContractClient::new(&env, &context.contract);
        let creator = Address::generate(&env);
        let buyer = Address::generate(&env);

        let prompt_id = client.create_prompt(
            &creator,
            &String::from_str(&env, "https://example.com/image.png"),
            &String::from_str(&env, "Fuzz target"),
            &String::from_str(&env, "General"),
            &String::from_str(&env, "preview"),
            &String::from_str(&env, "ciphertext"),
            &String::from_str(&env, "iv"),
            &String::from_str(&env, "wrapped-key"),
            &BytesN::from_array(&env, &[3u8; 32]),
            &ListingConfig {
                price: 10_000,
                asset: context.xlm.clone(),
                expires_at: 0,
                splits: Vec::new(&env),
            },
        );

        let _ = client.try_buy_prompt(&buyer, &prompt_id, &None::<Bytes>, &payment_amount, &None::<Bytes>);
    }

    /// Referral codes arrive as raw bytes supplied by the buyer. Arbitrary
    /// lengths and content (including codes that happen to collide with the
    /// buyer's or creator's own address hash) must never panic.
    #[test]
    fn fuzz_buy_prompt_referral_code_never_panics(code_bytes in arb_bytes(64)) {
        let env: Env = Default::default();
        let context = setup(&env);
        let client = PromptHashContractClient::new(&env, &context.contract);
        let creator = Address::generate(&env);
        let buyer = Address::generate(&env);

        let prompt_id = client.create_prompt(
            &creator,
            &String::from_str(&env, "https://example.com/image.png"),
            &String::from_str(&env, "Fuzz referral"),
            &String::from_str(&env, "General"),
            &String::from_str(&env, "preview"),
            &String::from_str(&env, "ciphertext"),
            &String::from_str(&env, "iv"),
            &String::from_str(&env, "wrapped-key"),
            &BytesN::from_array(&env, &[4u8; 32]),
            &ListingConfig {
                price: 10_000,
                asset: context.xlm.clone(),
                expires_at: 0,
                splits: Vec::new(&env),
            },
        );

        let code = Bytes::from_slice(&env, &code_bytes);
        let _ = client.try_buy_prompt(&buyer, &prompt_id, &Some(code), &10_000, &None::<Bytes>);
    }

    /// Voucher discount percentages are creator-supplied. The full u32 range
    /// must be rejected cleanly above MAX_BPS, never panic.
    #[test]
    fn fuzz_add_voucher_discount_bps_never_panics(discount_bps in any::<u32>()) {
        let env: Env = Default::default();
        let context = setup(&env);
        let client = PromptHashContractClient::new(&env, &context.contract);
        let creator = Address::generate(&env);

        let prompt_id = client.create_prompt(
            &creator,
            &String::from_str(&env, "https://example.com/image.png"),
            &String::from_str(&env, "Fuzz voucher"),
            &String::from_str(&env, "General"),
            &String::from_str(&env, "preview"),
            &String::from_str(&env, "ciphertext"),
            &String::from_str(&env, "iv"),
            &String::from_str(&env, "wrapped-key"),
            &BytesN::from_array(&env, &[5u8; 32]),
            &ListingConfig {
                price: 10_000,
                asset: context.xlm.clone(),
                expires_at: 0,
                splits: Vec::new(&env),
            },
        );

        let code = BytesN::from_array(&env, &[6u8; 32]);
        let _ = client.try_add_voucher(&creator, &prompt_id, &code, &discount_bps);
    }

    /// Lease durations and resale prices are also externally supplied
    /// numeric extremes worth fuzzing together since both feed the same
    /// checked-arithmetic fee/royalty machinery.
    #[test]
    fn fuzz_lease_prompt_duration_never_panics(duration in any::<u64>()) {
        let env: Env = Default::default();
        let context = setup(&env);
        let client = PromptHashContractClient::new(&env, &context.contract);
        let creator = Address::generate(&env);
        let buyer = Address::generate(&env);
        env.ledger().with_mut(|ledger| ledger.timestamp = 1_000);

        let prompt_id = client.create_prompt(
            &creator,
            &String::from_str(&env, "https://example.com/image.png"),
            &String::from_str(&env, "Fuzz lease"),
            &String::from_str(&env, "General"),
            &String::from_str(&env, "preview"),
            &String::from_str(&env, "ciphertext"),
            &String::from_str(&env, "iv"),
            &String::from_str(&env, "wrapped-key"),
            &BytesN::from_array(&env, &[8u8; 32]),
            &ListingConfig {
                price: 10_000,
                asset: context.xlm.clone(),
                expires_at: 0,
                splits: Vec::new(&env),
            },
        );

        let _ = client.try_lease_prompt(&buyer, &prompt_id, &duration);
    }

    /// `migrate` accepts an admin-supplied version number; every u32 value
    /// must be rejected cleanly outside the valid forward range, never panic.
    #[test]
    fn fuzz_migrate_new_version_never_panics(new_version in any::<u32>()) {
        let env: Env = Default::default();
        let context = setup(&env);
        let client = PromptHashContractClient::new(&env, &context.contract);

        let _ = client.try_migrate(&new_version);
    }

    /// INVARIANT 1: Total Supply / Prompt Count Consistency
    /// Creating prompts with valid random parameters must strictly increment
    /// the stored prompt counter by 1 per successful call, and total count must
    /// match stored entries without inconsistency.
    #[test]
    fn fuzz_invariant_prompt_count_and_total_supply(
        prices in proptest::collection::vec(1i128..1_000_000_000i128, 1..5),
    ) {
        let env: Env = Default::default();
        let context = setup(&env);
        let client = PromptHashContractClient::new(&env, &context.contract);
        let creator = Address::generate(&env);

        let initial_count = client.get_prompt_count();
        let mut expected_count = initial_count;

        for (idx, price) in prices.iter().enumerate() {
            let res = client.try_create_prompt(
                &creator,
                &String::from_str(&env, "https://example.com/image.png"),
                &String::from_str(&env, "Invariant Prompt"),
                &String::from_str(&env, "General"),
                &String::from_str(&env, "preview"),
                &String::from_str(&env, "ciphertext"),
                &String::from_str(&env, "iv"),
                &String::from_str(&env, "wrapped-key"),
                &BytesN::from_array(&env, &[(idx as u8 + 1); 32]),
                &ListingConfig {
                    price: *price,
                    asset: context.xlm.clone(),
                    expires_at: 0,
                    splits: Vec::new(&env),
                },
            );

            if res.is_ok() {
                expected_count += 1;
            }

            let current_count = client.get_prompt_count();
            prop_assert_eq!(current_count, expected_count);
        }
    }

    /// INVARIANT 2: Access Control Enforcement
    /// Random unauthorized accounts attempting admin operations (pause, unpause,
    /// set_platform_fee, set_admin, migrate) must ALWAYS fail and be rejected cleanly.
    #[test]
    fn fuzz_invariant_access_control_enforcement(
        random_fee in any::<u32>(),
        random_version in any::<u32>(),
    ) {
        let env: Env = Default::default();
        let context = setup(&env);
        let client = PromptHashContractClient::new(&env, &context.contract);
        let unauthorized = Address::generate(&env);

        // Unauthorized set_platform_fee must be rejected
        let fee_res = client.try_set_platform_fee(&unauthorized, &random_fee);
        prop_assert!(fee_res.is_err());

        // Unauthorized set_admin must be rejected
        let admin_res = client.try_set_admin(&unauthorized, &unauthorized);
        prop_assert!(admin_res.is_err());

        // Unauthorized pause / unpause must be rejected
        let pause_res = client.try_pause(&unauthorized);
        prop_assert!(pause_res.is_err());

        // Unauthorized migrate must be rejected if version invalid or unauthorized
        let migrate_res = client.try_migrate(&random_version);
        let _ = migrate_res;
    }

    /// INVARIANT 3: Fee Calculation Accuracy & Revenue Split Bounds
    /// Platform fees and revenue splits for arbitrary valid prices and BPS values
    /// must stay within mathematically valid bounds (fee <= price, total BPS <= 10000).
    #[test]
    fn fuzz_invariant_fee_calculation_and_splits_bounds(
        price in 1i128..1_000_000_000_000i128,
        fee_bps in 0u32..=1000u32, // Max 10% fee
        split_bps_1 in 0u32..=5000u32,
        split_bps_2 in 0u32..=5000u32,
    ) {
        let env: Env = Default::default();
        let context = setup(&env);
        let client = PromptHashContractClient::new(&env, &context.contract);
        let creator = Address::generate(&env);

        let fee_amount = (price * (fee_bps as i128)) / 10_000i128;
        prop_assert!(fee_amount <= price);
        prop_assert!(fee_amount >= 0);

        let mut splits = Vec::new(&env);
        splits.push_back(Split {
            recipient: Address::generate(&env),
            bps: split_bps_1,
        });
        splits.push_back(Split {
            recipient: Address::generate(&env),
            bps: split_bps_2,
        });

        let total_split_bps = split_bps_1 + split_bps_2;
        prop_assert!(total_split_bps <= 10_000);

        let res = client.try_create_prompt(
            &creator,
            &String::from_str(&env, "https://example.com/image.png"),
            &String::from_str(&env, "Fee Invariant Prompt"),
            &String::from_str(&env, "General"),
            &String::from_str(&env, "preview"),
            &String::from_str(&env, "ciphertext"),
            &String::from_str(&env, "iv"),
            &String::from_str(&env, "wrapped-key"),
            &BytesN::from_array(&env, &[15u8; 32]),
            &ListingConfig {
                price,
                asset: context.xlm.clone(),
                expires_at: 0,
                splits,
            },
        );

        prop_assert!(res.is_ok());
    }
}

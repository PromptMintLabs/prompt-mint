//! Gas / resource-cost benchmarks for every `prompt-hash` contract operation.
//!
//! Soroban does not use EVM-style gas. These tests record CPU instructions and
//! memory bytes via `Env::cost_estimate().budget()` (the native testutils
//! meter). CI compares the snapshot against `gas-baselines.json` and fails on a
//! >10% increase of either metric (issue #229).
//!
//! Native testutils under-count relative to Wasm, so treat the numbers as a
//! regression signal, not an exact on-chain fee quote. Re-seed baselines with:
//!
//! ```sh
//! UPDATE_GAS_BASELINES=1 cargo test -p prompt-hash --features isolate-gas-bench gas_benchmarks -- --nocapture
//! ```
extern crate std;

use crate::contract::{PromptHashContract, PromptHashContractClient};
use crate::mock_asset::FungibleTokenContract;
use crate::types::ListingConfig;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Bytes, BytesN, Env, String, Vec,
};
use std::collections::BTreeMap;
use std::fs;
use std::string::String as StdString;
use std::vec::Vec as StdVec;

const REGRESSION_THRESHOLD_PCT: u64 = 10;
const BASELINE_FILE: &str = "gas-baselines.json";
const REPORT_FILE: &str = "gas-report.json";

struct Sample {
    name: StdString,
    cpu: u64,
    mem: u64,
}

struct Context {
    admin: Address,
    admin_two: Address,
    admin_three: Address,
    upgrade_admin: Address,
    upgrade_admin_two: Address,
    upgrade_admin_three: Address,
    fee_wallet: Address,
    xlm: Address,
    contract: Address,
}

fn setup(env: &Env) -> Context {
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
            admin_two.clone(),
            admin_three.clone(),
            upgrade_admin.clone(),
            upgrade_admin_two.clone(),
            upgrade_admin_three.clone(),
            fee_wallet.clone(),
            xlm.clone(),
        ),
    );
    Context {
        admin,
        admin_two,
        admin_three,
        upgrade_admin,
        upgrade_admin_two,
        upgrade_admin_three,
        fee_wallet,
        xlm,
        contract,
    }
}

fn hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn fund(xlm: &token::StellarAssetClient<'_>, account: &Address, spender: &Address, amount: i128) {
    xlm.mint(account, &amount);
    xlm.approve(account, spender, &amount, &1_000);
}

fn listing(env: &Env, price: i128, asset: &Address, expires_at: u64) -> ListingConfig {
    ListingConfig {
        price,
        asset: asset.clone(),
        expires_at,
        splits: Vec::new(env),
    }
}

fn create_prompt(
    env: &Env,
    client: &PromptHashContractClient,
    creator: &Address,
    title: &str,
    price: i128,
    asset: &Address,
    expires_at: u64,
) -> u128 {
    client.create_prompt(
        creator,
        &String::from_str(env, "https://example.com/prompt.png"),
        &String::from_str(env, title),
        &String::from_str(env, "Software Development"),
        &String::from_str(env, "Generate a production-ready implementation plan."),
        &String::from_str(env, "ciphertext"),
        &String::from_str(env, "iv"),
        &String::from_str(env, "wrapped-key"),
        &hash(env, 7),
        &listing(env, price, asset, expires_at),
    )
}

fn reset_budget(env: &Env) {
    let mut budget = env.cost_estimate().budget();
    budget.reset_unlimited();
    budget.reset_tracker();
}

fn read_budget(env: &Env) -> (u64, u64) {
    let budget = env.cost_estimate().budget();
    (budget.cpu_instruction_cost(), budget.memory_bytes_cost())
}

fn sample(env: &Env, samples: &mut StdVec<Sample>, name: &str, f: impl FnOnce()) {
    reset_budget(env);
    f();
    let (cpu, mem) = read_budget(env);
    samples.push(Sample {
        name: StdString::from(name),
        cpu,
        mem,
    });
}

fn write_json(path: &str, samples: &[Sample]) {
    let mut body = StdString::from("{\n  \"regression_threshold_pct\": 10,\n  \"operations\": {\n");
    for (i, s) in samples.iter().enumerate() {
        body.push_str(&format!(
            "    \"{}\": {{ \"cpu\": {}, \"mem\": {} }}{}\n",
            s.name,
            s.cpu,
            s.mem,
            if i + 1 == samples.len() { "" } else { "," }
        ));
    }
    body.push_str("  }\n}\n");
    fs::write(path, body).unwrap();
}

fn parse_baselines(text: &str) -> BTreeMap<StdString, (u64, u64)> {
    let mut map = BTreeMap::new();
    let mut current: Option<StdString> = None;
    let mut cpu: Option<u64> = None;
    for raw in text.lines() {
        let line = raw.trim().trim_end_matches(',');
        if let Some(rest) = line.strip_prefix('"') {
            if let Some(end) = rest.find('"') {
                let key = &rest[..end];
                let after = rest[end + 1..].trim();
                if after.starts_with(':') && after.contains('{') && key != "operations" {
                    current = Some(StdString::from(key));
                    cpu = None;
                }
            }
        }
        if let Some(rest) = line.strip_prefix("\"cpu\"") {
            let value = rest.trim().trim_start_matches(':').trim();
            cpu = value.parse().ok();
        }
        if let Some(rest) = line.strip_prefix("\"mem\"") {
            let value = rest.trim().trim_start_matches(':').trim();
            if let (Some(name), Some(c), Ok(m)) = (current.take(), cpu.take(), value.parse::<u64>())
            {
                map.insert(name, (c, m));
            }
        }
    }
    map
}

fn exceeds(actual: u64, baseline: u64, pct: u64) -> bool {
    if baseline == 0 {
        return false;
    }
    actual > baseline + (baseline.saturating_mul(pct) / 100)
}

#[test]
fn gas_benchmarks_all_contract_operations() {
    let env: Env = Default::default();
    env.ledger().with_mut(|l| {
        l.timestamp = 1_000;
        l.sequence_number = 10;
    });

    let mut samples: StdVec<Sample> = StdVec::new();

    // constructor is invoked by `register`; measure a second deployment.
    sample(&env, &mut samples, "constructor", || {
        let admin = Address::generate(&env);
        let admin_two = Address::generate(&env);
        let admin_three = Address::generate(&env);
        let upgrade_admin = Address::generate(&env);
        let upgrade_admin_two = Address::generate(&env);
        let upgrade_admin_three = Address::generate(&env);
        let fee_wallet = Address::generate(&env);
        let xlm = env.register(FungibleTokenContract, (admin.clone(),));
        let _ = env.register(
            PromptHashContract,
            (
                admin,
                admin_two,
                admin_three,
                upgrade_admin,
                upgrade_admin_two,
                upgrade_admin_three,
                fee_wallet,
                xlm,
            ),
        );
    });

    let context = setup(&env);
    let client = PromptHashContractClient::new(&env, &context.contract);
    let xlm = token::StellarAssetClient::new(&env, &context.xlm);
    let creator = Address::generate(&env);
    let buyer = Address::generate(&env);
    let buyer_two = Address::generate(&env);
    let reseller = Address::generate(&env);
    let subscriber = Address::generate(&env);
    let referrer = Address::generate(&env);
    let moderator = Address::generate(&env);

    fund(&xlm, &buyer, &context.contract, 1_000_000);
    fund(&xlm, &buyer_two, &context.contract, 1_000_000);
    fund(&xlm, &reseller, &context.contract, 1_000_000);
    fund(&xlm, &subscriber, &context.contract, 1_000_000);
    fund(&xlm, &creator, &context.contract, 1_000_000);

    let mut prompt_id = 0u128;
    sample(&env, &mut samples, "create_prompt", || {
        prompt_id = create_prompt(&env, &client, &creator, "Gas Prompt", 10_000, &context.xlm, 0);
    });

    sample(&env, &mut samples, "set_prompt_sale_status", || {
        client.set_prompt_sale_status(&creator, &prompt_id, &true);
    });
    sample(&env, &mut samples, "set_prompt_max_supply", || {
        client.set_prompt_max_supply(&creator, &prompt_id, &1_000u64);
    });
    sample(&env, &mut samples, "update_prompt_price", || {
        client.update_prompt_price(&creator, &prompt_id, &10_000);
    });

    let voucher_code = Bytes::from_slice(&env, b"SAVE10");
    let voucher_hash = BytesN::from_array(&env, &env.crypto().sha256(&voucher_code).to_array());
    sample(&env, &mut samples, "add_voucher", || {
        client.add_voucher(&creator, &prompt_id, &voucher_hash, &1_000u32);
    });
    sample(&env, &mut samples, "remove_voucher", || {
        client.remove_voucher(&creator, &prompt_id, &voucher_hash);
    });

    sample(&env, &mut samples, "buy_prompt", || {
        client.buy_prompt(
            &buyer,
            &prompt_id,
            &None::<Bytes>,
            &10_000i128,
            &None::<Bytes>,
        );
    });
    sample(&env, &mut samples, "has_access", || {
        let _ = client.has_access(&buyer, &prompt_id);
    });
    sample(&env, &mut samples, "get_prompt", || {
        let _ = client.get_prompt(&prompt_id);
    });
    sample(&env, &mut samples, "get_all_prompts", || {
        let _ = client.get_all_prompts();
    });
    sample(&env, &mut samples, "get_prompts_by_creator", || {
        let _ = client.get_prompts_by_creator(&creator);
    });
    sample(&env, &mut samples, "get_prompts_by_buyer", || {
        let _ = client.get_prompts_by_buyer(&buyer);
    });
    sample(&env, &mut samples, "get_purchase_details", || {
        let _ = client.get_purchase_details(&prompt_id, &buyer);
    });

    sample(&env, &mut samples, "transfer_license", || {
        client.transfer_license(&buyer, &prompt_id, &buyer_two, &12_000i128);
    });

    let lease_id = create_prompt(&env, &client, &creator, "Lease Gas", 8_000, &context.xlm, 0);
    sample(&env, &mut samples, "lease_prompt", || {
        client.lease_prompt(&reseller, &lease_id, &600u64);
    });

    let expiring_id = create_prompt(
        &env,
        &client,
        &creator,
        "Expiring Gas",
        5_000,
        &context.xlm,
        5_000,
    );
    sample(&env, &mut samples, "extend_listing", || {
        client.extend_listing(&creator, &expiring_id, &9_000u64);
    });

    let bulk_a = create_prompt(&env, &client, &creator, "Bulk A", 4_000, &context.xlm, 0);
    let bulk_b = create_prompt(&env, &client, &creator, "Bulk B", 4_000, &context.xlm, 0);
    sample(&env, &mut samples, "buy_prompts_bulk", || {
        let mut ids = Vec::new(&env);
        ids.push_back(bulk_a);
        ids.push_back(bulk_b);
        let mut amounts = Vec::new(&env);
        amounts.push_back(4_000i128);
        amounts.push_back(4_000i128);
        client.buy_prompts_bulk(&buyer, &ids, &amounts, &None::<Bytes>);
    });

    sample(&env, &mut samples, "configure_subscription_pass", || {
        client.configure_subscription_pass(&creator, &600u64, &10_000i128, &context.xlm, &true);
    });
    sample(&env, &mut samples, "set_subscription_eligibility", || {
        client.set_subscription_eligibility(&creator, &lease_id, &true);
    });
    sample(&env, &mut samples, "subscribe_catalog", || {
        let _ = client.subscribe_catalog(&subscriber, &creator, &10_000i128);
    });
    sample(&env, &mut samples, "renew_catalog_subscription", || {
        let _ = client.renew_catalog_subscription(&subscriber, &creator, &10_000i128);
    });
    sample(&env, &mut samples, "get_subscription", || {
        let _ = client.get_subscription(&subscriber, &creator);
    });
    sample(&env, &mut samples, "get_subscription_config", || {
        let _ = client.get_subscription_config(&creator);
    });
    sample(&env, &mut samples, "is_subscription_eligible", || {
        let _ = client.is_subscription_eligible(&lease_id);
    });

    sample(&env, &mut samples, "set_fee_percentage", || {
        client.set_fee_percentage(&500u32, &context.admin, &context.admin_two);
    });
    sample(&env, &mut samples, "set_fee_wallet", || {
        client.set_fee_wallet(&context.fee_wallet, &context.admin, &context.admin_two);
    });
    sample(&env, &mut samples, "get_fee_percentage", || {
        let _ = client.get_fee_percentage();
    });
    sample(&env, &mut samples, "get_fee_wallet", || {
        let _ = client.get_fee_wallet();
    });
    sample(&env, &mut samples, "set_referral_percentage", || {
        client.set_referral_percentage(&500u32);
    });
    sample(&env, &mut samples, "get_referral_percentage", || {
        let _ = client.get_referral_percentage();
    });
    sample(&env, &mut samples, "register_referral_code", || {
        let code = Bytes::from_slice(&env, b"AFFILIATE");
        let hashed = BytesN::from_array(&env, &env.crypto().sha256(&code).to_array());
        client.register_referral_code(&referrer, &hashed);
    });
    sample(&env, &mut samples, "set_pause_status", || {
        client.set_pause_status(&false, &context.admin, &context.admin_two);
    });
    sample(&env, &mut samples, "is_paused", || {
        let _ = client.is_paused();
    });
    sample(&env, &mut samples, "get_xlm_sac", || {
        let _ = client.get_xlm_sac();
    });
    sample(&env, &mut samples, "extend_ttl", || {
        client.extend_ttl(&crate::types::DataKey::Prompt(prompt_id));
    });
    sample(&env, &mut samples, "get_schema_version", || {
        let _ = client.get_schema_version();
    });

    let mut bundle_ids = Vec::new(&env);
    bundle_ids.push_back(lease_id);
    bundle_ids.push_back(expiring_id);
    let mut bundle_id = 0u128;
    sample(&env, &mut samples, "create_bundle", || {
        bundle_id = client.create_bundle(
            &creator,
            &String::from_str(&env, "Gas Bundle"),
            &String::from_str(&env, "Two listings"),
            &String::from_str(&env, "https://example.com/bundle.png"),
            &bundle_ids,
            &12_000i128,
            &context.xlm,
        );
    });
    let extra_item = create_prompt(&env, &client, &creator, "Bundle Extra", 3_000, &context.xlm, 0);
    sample(&env, &mut samples, "add_bundle_item", || {
        client.add_bundle_item(&creator, &bundle_id, &extra_item);
    });
    sample(&env, &mut samples, "remove_bundle_item", || {
        client.remove_bundle_item(&creator, &bundle_id, &extra_item);
    });
    sample(&env, &mut samples, "update_bundle_price", || {
        client.update_bundle_price(&creator, &bundle_id, &11_000i128);
    });
    sample(&env, &mut samples, "set_bundle_active", || {
        client.set_bundle_active(&creator, &bundle_id, &true);
    });
    sample(&env, &mut samples, "buy_bundle", || {
        client.buy_bundle(&reseller, &bundle_id, &11_000i128, &None::<Address>);
    });
    sample(&env, &mut samples, "has_bundle_access", || {
        let _ = client.has_bundle_access(&reseller, &bundle_id);
    });
    sample(&env, &mut samples, "get_bundle", || {
        let _ = client.get_bundle(&bundle_id);
    });
    sample(&env, &mut samples, "get_all_bundles", || {
        let _ = client.get_all_bundles();
    });
    sample(&env, &mut samples, "get_bundles_by_creator", || {
        let _ = client.get_bundles_by_creator(&creator);
    });
    sample(&env, &mut samples, "get_bundles_by_buyer", || {
        let _ = client.get_bundles_by_buyer(&reseller);
    });

    sample(&env, &mut samples, "set_classification", || {
        client.set_classification(
            &creator,
            &lease_id,
            &String::from_str(&env, "technical"),
            &Vec::new(&env),
        );
    });
    sample(&env, &mut samples, "get_classification", || {
        let _ = client.get_classification(&lease_id);
    });
    sample(&env, &mut samples, "set_moderator_address", || {
        client.set_moderator_address(&context.admin, &moderator);
    });
    sample(&env, &mut samples, "set_moderator_override", || {
        client.set_moderator_override(
            &moderator,
            &lease_id,
            &String::from_str(&env, "restricted"),
            &Vec::new(&env),
            &String::from_str(&env, "flagged for review"),
        );
    });
    sample(&env, &mut samples, "get_active_classification", || {
        let _ = client.get_active_classification(&lease_id);
    });
    sample(&env, &mut samples, "get_moderator_override", || {
        let _ = client.get_moderator_override(&lease_id);
    });

    sample(&env, &mut samples, "create_promotion", || {
        let _ = client.create_promotion(
            &creator,
            &expiring_id,
            &2_000u64,
            &8_000u64,
            &3_000i128,
            &context.xlm,
        );
    });
    sample(&env, &mut samples, "get_active_promotion", || {
        let _ = client.get_active_promotion(&expiring_id);
    });
    sample(&env, &mut samples, "get_promotion_history", || {
        let _ = client.get_promotion_history(&expiring_id);
    });
    sample(&env, &mut samples, "get_effective_price", || {
        let _ = client.get_effective_price(&expiring_id);
    });
    sample(&env, &mut samples, "cancel_promotion", || {
        client.cancel_promotion(&creator, &expiring_id);
    });

    sample(&env, &mut samples, "rotate_encryption", || {
        let _ = client.rotate_encryption(
            &creator,
            &lease_id,
            &String::from_str(&env, "encrypted-v2"),
            &String::from_str(&env, "iv-v2"),
            &String::from_str(&env, "wrapped-key-v2"),
            &hash(&env, 2),
        );
    });
    sample(&env, &mut samples, "get_prompt_encryption_version", || {
        let _ = client.get_prompt_encryption_version(&lease_id, &1u32);
    });

    sample(&env, &mut samples, "set_discount", || {
        client.set_discount(&creator, &extra_item, &2_000i128, &1u32, &10_000u32);
    });
    sample(&env, &mut samples, "get_discount", || {
        let _ = client.get_discount(&extra_item);
    });
    sample(&env, &mut samples, "clear_discount", || {
        client.clear_discount(&creator, &extra_item);
    });

    sample(&env, &mut samples, "stake", || {
        let _ = client.stake(&creator, &lease_id, &20_000i128);
    });
    sample(&env, &mut samples, "get_stake", || {
        let _ = client.get_stake(&lease_id);
    });
    sample(&env, &mut samples, "slash", || {
        let _ = client.slash(&lease_id, &5_000i128);
    });
    env.ledger().with_mut(|l| {
        l.timestamp = 1_000 + 7 * 24 * 60 * 60;
    });
    sample(&env, &mut samples, "unstake", || {
        let _ = client.unstake(&creator, &lease_id, &5_000i128);
    });

    let manifest = env!("CARGO_MANIFEST_DIR");
    let report_path = format!("{manifest}/{REPORT_FILE}");
    let baseline_path = format!("{manifest}/{BASELINE_FILE}");
    write_json(&report_path, &samples);

    let update = std::env::var("UPDATE_GAS_BASELINES").ok().as_deref() == Some("1");
    if update || !fs::metadata(&baseline_path).is_ok() {
        write_json(&baseline_path, &samples);
        std::eprintln!("Wrote gas baselines to {baseline_path}");
        return;
    }

    let baselines = parse_baselines(&fs::read_to_string(&baseline_path).unwrap());
    let mut failures: StdVec<StdString> = StdVec::new();
    for sample in &samples {
        match baselines.get(&sample.name) {
            None => failures.push(format!(
                "{}: missing from {BASELINE_FILE} (cpu={}, mem={})",
                sample.name, sample.cpu, sample.mem
            )),
            Some(&(cpu, mem)) => {
                if cpu == 0 && mem == 0 {
                    std::eprintln!("  {} unseeded baseline — skipping 10% gate", sample.name);
                    continue;
                }
                if exceeds(sample.cpu, cpu, REGRESSION_THRESHOLD_PCT) {
                    failures.push(format!(
                        "{}: CPU {} > 10% over baseline {} (limit {})",
                        sample.name,
                        sample.cpu,
                        cpu,
                        cpu + cpu * REGRESSION_THRESHOLD_PCT / 100
                    ));
                }
                if exceeds(sample.mem, mem, REGRESSION_THRESHOLD_PCT) {
                    failures.push(format!(
                        "{}: memory {} > 10% over baseline {} (limit {})",
                        sample.name,
                        sample.mem,
                        mem,
                        mem + mem * REGRESSION_THRESHOLD_PCT / 100
                    ));
                }
            }
        }
    }

    std::eprintln!("Gas report written to {report_path}");
    for s in &samples {
        std::eprintln!("  {:<32} cpu={:<12} mem={}", s.name, s.cpu, s.mem);
    }

    if !failures.is_empty() {
        panic!(
            "gas regression (>{}%) detected:\n  {}",
            REGRESSION_THRESHOLD_PCT,
            failures.join("\n  ")
        );
    }
}

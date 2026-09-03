#clo_std]

#[allow(dead_code)]

#[allow(clippy::too_many_arguments)]

// Test builds get `std` (and therefore `alloc`) back so dev-dependencies like
// `proptest` work normally; the deployed wasm contract stays strictly `no_std`.
#[cfg(test)]
extern crate std;

mod contract;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod mock_asset;

#[cfg(test)]
mod mock_has_access;

#[cfg(all(test, not(feature = "isolate-gas-bench"))]
mod test;

#[cfg(all(test, not(feature = "isolate-gas-bench"))]
mod fuzz;

#[cfg(test)]
mod gas_bench;

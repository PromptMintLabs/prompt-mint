use soroban_sdk:{contract, contractimpl, Address, Env};
#[contract]
pub struct MockHasAccess;

#[contractimpl]
impl MockHasAccess {
    pub fn has_access(_env: Env, _user: Address) -> bool {
        // Happy path mock always grants access.
        true
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::contract::PromptHashContract;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn unlock_happy_path() {
        let env = Env::default();
        env.mock_all_auths();

        let user = Address::generate(&env);
        let has_access_id = env.register_contract(None, MockHasAccess);
        let contract_id = env.register_contract(None, PromptHashContract);

        let challenge = PromptHashContract::challenge(&env, &contract_id, &user);
        let signature = PromptHashContract::sign(&env, &contract_id, &user, &challenge);
        let unlocked = PromptHashContract::unlock(&env, &contract_id, &user, &signature, &has_access_id);

        assert(unlocked);
    }
}
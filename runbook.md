# Security Incident Runbook: `UNLOCK_PRIVATE_KEY` Compromise

## Purpose

This runbook defines the required response if the `UNLOCK_PRIVATE_KEY` used by the application is suspected or confirmed to be compromised.

The objectives are to:

1. Prevent further unauthorized transactions.
2. Protect customer funds and sensitive data.
3. Rotate compromised credentials safely.
4. Pause affected smart-contract functionality where possible.
5. Communicate clearly with affected customers.
6. Preserve evidence for investigation and post-incident review.

---

## 1. Trigger Conditions

Activate this runbook immediately if any of the following occurs:

* `UNLOCK_PRIVATE_KEY` is exposed in source code, logs, CI/CD output, screenshots, or public repositories.
* The secret is accidentally committed to GitHub or another public/private repository.
* Unauthorized transactions originate from the associated wallet.
* The private key is shared with an unauthorized person or service.
* There is evidence of unauthorized access to the server, deployment environment, secret manager, or CI/CD system containing the key.
* A security monitoring system reports suspicious activity involving the associated wallet.

**Assumption:** Treat a leaked private key as fully compromised, even if there is no evidence that it has been used.

---

# 2. Severity

Classify a confirmed private-key compromise as a **Critical Security Incident (SEV-1)** when the key can authorize transactions, withdraw funds, upgrade contracts, or otherwise affect customer assets.

Do not wait for confirmation of malicious activity before beginning containment.

---

# 3. Immediate Containment — First 15 Minutes

### 3.1 Stop automated transactions

Immediately disable application processes that can use `UNLOCK_PRIVATE_KEY`.

Depending on the deployment architecture:

* Disable the affected API/service.
* Stop transaction workers or queue consumers.
* Disable scheduled jobs using the key.
* Temporarily disable withdrawal/payment functionality.
* Block administrative transaction endpoints.
* Revoke or disable affected deployment credentials if necessary.

Do **not** simply delete the environment variable and assume the incident is resolved.

### 3.2 Pause the contract

If the affected contract supports an emergency pause mechanism:

1. Pause the contract immediately using a **known-secure authorized account**.
2. Confirm the pause transaction on-chain.
3. Verify that affected operations are no longer executable.
4. Record the transaction hash and timestamp in the incident log.

If the compromised key itself controls the pause mechanism, **do not use the compromised key**.

Use a separate, trusted emergency/admin key.

If no secure pause authority exists, immediately restrict application access to the affected contract functions.

### 3.3 Secure the compromised key

Do not attempt to "fix" the existing private key.

Consider the key compromised permanently.

* Remove it from active workloads.
* Revoke access to the secret store containing it.
* Rotate associated credentials.
* Preserve the original secret only where required for forensic investigation and according to the organization's incident-response policy.
* Never paste the private key into incident tickets, chat, GitHub issues, or customer communications.

---

# 4. Investigate the Compromise

Record:

* Date and time the compromise was discovered.
* Date and time the key may have been exposed.
* Where the key was exposed.
* Wallet/account address associated with the key.
* Contract(s) controlled by the key.
* Last known legitimate transaction.
* First suspicious transaction.
* All suspicious transaction hashes.
* Current wallet balances.
* Potentially affected customer accounts.
* Systems and environments containing the key.

### On-chain investigation

Review the associated account for:

* Unauthorized transfers.
* Contract calls.
* Token approvals.
* Administrative actions.
* Contract upgrades.
* Unexpected ownership changes.
* Changes to configuration or permissions.

Record all relevant transaction hashes.

Do not interact with suspicious contracts or addresses beyond what is necessary for containment.

---

# 5. Key Rotation

## 5.1 Generate a new key

Generate a completely new cryptographic key using an approved secure mechanism.

**Never derive the new key from the compromised key.**

The new key must:

* Never have been exposed previously.
* Be generated using a cryptographically secure process.
* Be stored in the organization's approved secret manager.
* Have the minimum permissions required.
* Not be committed to source control.

Example environment variable:

```env
UNLOCK_PRIVATE_KEY=<NEW_PRIVATE_KEY>
```

Do not place the actual value in documentation.

## 5.2 Update the secret store

Update the production secret in the approved secret-management system.

Examples include:

* Vercel Environment Variables
* AWS Secrets Manager
* Google Secret Manager
* Azure Key Vault
* HashiCorp Vault
* Another approved enterprise secret manager

Ensure the old key is removed from:

* Production environments
* Preview environments
* Staging environments, if affected
* CI/CD variables
* Local development environments where applicable

## 5.3 Redeploy

Redeploy the application using the new secret.

After deployment:

1. Verify the application starts successfully.
2. Verify transaction signing works.
3. Confirm the application is using the new wallet/account.
4. Confirm no service still references the compromised key.
5. Check application and deployment logs for secret exposure.

Never print the value of `UNLOCK_PRIVATE_KEY` while testing.

---

# 6. Contract Authorization Rotation

If `UNLOCK_PRIVATE_KEY` corresponds to an account with contract privileges, rotate those privileges as well.

Examples:

* Contract owner
* Admin
* Pauser
* Upgrader
* Treasury operator
* Relayer
* Payment processor

Where supported:

1. Transfer ownership/admin rights to the new secure account.
2. Remove the compromised account's permissions.
3. Verify the change on-chain.
4. Confirm the new account can perform required administrative operations.
5. Confirm the compromised account can no longer perform those operations.

**Important:** Rotating the application secret alone is insufficient if the compromised wallet remains authorized on-chain.

---

# 7. Customer Funds Assessment

Determine whether customer assets may have been affected.

Classify customers into:

### Affected

Evidence indicates their funds, transactions, or account security were directly impacted.

### Potentially affected

Their assets were controlled by or exposed to a compromised system, but no unauthorized transaction has been identified.

### Not affected

Investigation confirms their assets and accounts were outside the compromised scope.

Maintain a record of the classification and supporting evidence.

---

# 8. Customer Communication

Customer communication should begin once immediate containment is complete.

Do not disclose sensitive security information that could increase the attacker's ability to exploit the incident.

Communication should clearly state:

* What happened.
* When the issue was detected.
* What actions were taken.
* Whether customer funds are affected or potentially affected.
* Whether customers need to take action.
* Where future updates will be provided.
* How customers can contact support.

Avoid speculation.

Do not claim that funds are safe until the investigation supports that conclusion.

### Customer Notification Template

Hello,

We are writing to inform you of a security incident involving one of the credentials used to operate part of our platform.

We detected the issue on [DATE/TIME] and immediately took steps to contain it, including disabling affected operations, securing the compromised credential, and rotating the relevant access credentials.

We are currently investigating the incident and reviewing affected transactions and systems.

At this time:

* [STATE WHETHER CUSTOMER FUNDS ARE AFFECTED, POTENTIALLY AFFECTED, OR CURRENTLY SHOW NO EVIDENCE OF IMPACT.]
* [STATE WHETHER ANY CUSTOMER ACTION IS REQUIRED.]
* [STATE WHETHER SPECIFIC SERVICES ARE TEMPORARILY PAUSED.]

We understand the importance of your trust and are treating this matter as a critical security incident. We will provide further updates through [OFFICIAL CHANNEL] as our investigation progresses.

If you notice any activity on your account that you do not recognize, please contact [SUPPORT CHANNEL] immediately.

We apologize for the disruption and appreciate your patience while we work to fully resolve the issue.

Regards,
[promptmint/IT Team]

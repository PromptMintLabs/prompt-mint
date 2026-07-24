# Artifact Verification

Every release artifact published by PromptHash is checksummed, cryptographically signed, and bound to the source commit and workflow identity via SLSA provenance attestations. This document explains how to verify that artifacts have not been tampered with.

## Artifacts Per Release

| Artifact | Description |
|---|---|
| `prompt_hash.wasm` | Soroban contract binary |
| `release-checksums.txt` | SHA256 manifest of all artifacts |
| `release-checksums.txt.sha256` | SHA256 of the manifest itself |
| `release-checksums.txt.sig` | Cosign signature bundle for the manifest |
| `*.wasm.sig` | Cosign signature bundle per WASM file |
| SLSA provenance | Attestation published by `actions/attest-build-provenance` |

## Prerequisites

- [cosign](https://docs.sigstore.dev/system_config/installation/) v2.4+
- OpenSSL or `sha256sum` (available on macOS and Linux)
- `gh` CLI (for downloading provenance attestations)

## Verification Steps

### 1. Download Release Artifacts

```bash
VERSION="v1"  # Replace with the actual release tag
gh release download "$VERSION" --repo PromptMintLabs/prompt-mint
```

### 2. Verify Checksum Integrity

```bash
# Verify the checksum manifest itself has not been tampered with
sha256sum -c release-checksums.txt.sha256

# Verify all artifact checksums against the manifest
sha256sum -c release-checksums.txt
```

If either check fails, the artifacts have been tampered with and **must not** be used.

### 3. Verify Cosign Signatures

```bash
# Verify the checksum manifest signature
cosign verify-blob \
  --bundle release-checksums.txt.sig \
  --certificate-identity-regexp "https://github.com/PromptMintLabs/prompt-mint/.github/workflows/deploy.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  release-checksums.txt

# Verify each WASM artifact signature
cosign verify-blob \
  --bundle prompt_hash.wasm.sig \
  --certificate-identity-regexp "https://github.com/PromptMintLabs/prompt-mint/.github/workflows/deploy.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  prompt_hash.wasm
```

### 4. Verify SLSA Provenance Attestation

The provenance attestation binds the artifact digests to the exact source commit, workflow, and build inputs.

```bash
# Download the attestation
gh attestation download prompt_hash.wasm \
  --repo PromptMintLabs/prompt-mint \
  --output-dir ./attestations

# Inspect the attestation (optional)
cat ./attestations/prompt_hash.wasm.jsonld | jq .
```

The attestation contains:
- `subject`: The artifact digest
- `buildDefinition.buildType`: The CI workflow
- `runDetails.builder.id`: The GitHub Actions runner
- `runDetails.metadata.invocationId`: The workflow run ID

### 5. Automated Verification Script

```bash
# Run the automated verification script
./scripts/verify-artifact.sh \
  --version v1 \
  --repo PromptMintLabs/prompt-mint
```

## What Tampering Looks Like

| Scenario | Verification Result |
|---|---|
| Untampered artifact | All checks pass |
| Modified WASM binary | SHA256 mismatch on `sha256sum -c` |
| Modified checksum manifest | SHA256 mismatch on `release-checksums.txt.sha256` |
| Replaced signature bundle | Cosign `verify-blob` fails with certificate identity mismatch |
| Different source commit | SLSA provenance `subject` digest does not match artifact |
| Artifact from unauthorized workflow | Cosign certificate identity does not match `deploy.yml` |

## Security Properties

- **Non-repudiation**: Signatures are bound to the GitHub Actions OIDC identity
- **Tamper evidence**: Checksums make any modification detectable
- **Provenance chain**: SLSA attestation connects the artifact back to the exact source commit and CI run
- **No privileged access required**: All verification is done with public tools and public repository data

## CI/CD Integration

The signing and attestation steps run automatically in the `deploy.yml` workflow on every push to `main`:

1. `contract-build` job: Builds WASM, generates checksums
2. `sign-artifacts` job: Downloads artifacts, creates manifest, signs with cosign, generates SLSA provenance
3. `create-release` job: Verifies signatures, publishes GitHub Release with all signed artifacts and attestations

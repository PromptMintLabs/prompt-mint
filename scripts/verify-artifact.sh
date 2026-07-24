#!/bin/bash
set -euo pipefail

# PromptHash Artifact Verification Script
# Usage: ./scripts/verify-artifact.sh --version v1 --repo PromptMintLabs/prompt-mint

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo "Usage: $0 --version <tag> --repo <owner/repo>"
  echo ""
  echo "Verifies the integrity and signatures of a PromptHash release."
  echo ""
  echo "Options:"
  echo "  --version, -v   Release tag (e.g. v1, v2)"
  echo "  --repo, -r      GitHub repository (e.g. PromptMintLabs/prompt-mint)"
  echo "  --help, -h      Show this help message"
  exit 1
}

check_deps() {
  local missing=0
  for cmd in gh sha256sum cosign jq; do
    if ! command -v "$cmd" &>/dev/null; then
      echo -e "${RED}Error: $cmd is not installed.${NC}"
      missing=1
    fi
  done
  if [ "$missing" -eq 1 ]; then
    echo "Install missing dependencies and try again."
    echo "  gh: https://cli.github.com/"
    echo "  cosign: https://docs.sigstore.dev/system_config/installation/"
    echo "  jq: https://jqlang.github.io/jq/download/"
    exit 1
  fi
}

verify_checksums() {
  local dir="$1"
  local failed=0

  echo -e "${YELLOW}[1/4] Verifying checksum manifest integrity...${NC}"
  if ! (cd "$dir" && sha256sum -c release-checksums.txt.sha256 2>/dev/null); then
    echo -e "${RED}FAILED: Checksum manifest has been tampered with${NC}"
    failed=1
  else
    echo -e "${GREEN}PASSED: Checksum manifest is intact${NC}"
  fi

  echo -e "${YELLOW}[2/4] Verifying artifact checksums...${NC}"
  if ! (cd "$dir" && sha256sum -c release-checksums.txt 2>/dev/null); then
    echo -e "${RED}FAILED: One or more artifacts have been modified${NC}"
    failed=1
  else
    echo -e "${GREEN}PASSED: All artifact checksums match${NC}"
  fi

  return "$failed"
}

verify_signatures() {
  local dir="$1"
  local repo="$2"
  local failed=0

  echo -e "${YELLOW}[3/4] Verifying cosign signatures...${NC}"

  if [ -f "$dir/release-checksums.txt.sig" ]; then
    if cosign verify-blob \
      --bundle "$dir/release-checksums.txt.sig" \
      --certificate-identity-regexp "https://github.com/${repo}/.github/workflows/deploy.yml@refs/heads/main" \
      --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
      "$dir/release-checksums.txt" &>/dev/null; then
      echo -e "${GREEN}PASSED: Checksum manifest signature verified${NC}"
    else
      echo -e "${RED}FAILED: Checksum manifest signature verification failed${NC}"
      failed=1
    fi
  else
    echo -e "${RED}FAILED: release-checksums.txt.sig not found${NC}"
    failed=1
  fi

  for wasm_sig in "$dir"/*.wasm.sig; do
    if [ ! -f "$wasm_sig" ]; then
      continue
    fi
    local wasm_file="${wasm_sig%.sig}"
    if [ -f "$wasm_file" ]; then
      if cosign verify-blob \
        --bundle "$wasm_sig" \
        --certificate-identity-regexp "https://github.com/${repo}/.github/workflows/deploy.yml@refs/heads/main" \
        --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
        "$wasm_file" &>/dev/null; then
        echo -e "${GREEN}PASSED: $(basename "$wasm_file") signature verified${NC}"
      else
        echo -e "${RED}FAILED: $(basename "$wasm_file") signature verification failed${NC}"
        failed=1
      fi
    fi
  done

  return "$failed"
}

verify_provenance() {
  local dir="$1"
  local repo="$2"
  local failed=0

  echo -e "${YELLOW}[4/4] Checking SLSA provenance attestation...${NC}"

  local has_attestation=0
  for wasm in "$dir"/*.wasm; do
    if [ ! -f "$wasm" ]; then
      continue
    fi
    local basename_wasm
    basename_wasm=$(basename "$wasm")
    if gh attestation download "$basename_wasm" \
      --repo "$repo" \
      --output-dir "$dir/attestations" 2>/dev/null; then
      echo -e "${GREEN}PASSED: Provenance attestation found for $basename_wasm${NC}"
      has_attestation=1
    else
      echo -e "${YELLOW}WARN: No provenance attestation found for $basename_wasm (may not be published yet)${NC}"
    fi
  done

  if [ "$has_attestation" -eq 0 ]; then
    echo -e "${YELLOW}SKIP: No attestations available to verify${NC}"
  fi

  return "$failed"
}

main() {
  local version=""
  local repo=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --version|-v) shift; version="$1";;
      --repo|-r) shift; repo="$1";;
      --help|-h) usage;;
      *) echo "Unknown option: $1"; usage;;
    esac
    shift
  done

  if [ -z "$version" ] || [ -z "$repo" ]; then
    usage
  fi

  check_deps

  local workdir
  workdir=$(mktemp -d)
  trap 'rm -rf "$workdir"' EXIT

  echo -e "${YELLOW}Downloading release $version from $repo...${NC}"
  gh release download "$version" --repo "$repo" --dir "$workdir"

  echo ""
  echo "=========================================="
  echo " Artifact Verification Report"
  echo " Version: $version"
  echo " Repository: $repo"
  echo "=========================================="
  echo ""

  local exit_code=0

  verify_checksums "$workdir" || exit_code=1
  echo ""
  verify_signatures "$workdir" "$repo" || exit_code=1
  echo ""
  verify_provenance "$workdir" "$repo" || exit_code=1

  echo ""
  echo "=========================================="
  if [ "$exit_code" -eq 0 ]; then
    echo -e "${GREEN}All verification checks passed.${NC}"
    echo -e "${GREEN}Artifacts are authentic and untampered.${NC}"
  else
    echo -e "${RED}One or more verification checks FAILED.${NC}"
    echo -e "${RED}Do NOT use these artifacts.${NC}"
  fi
  echo "=========================================="

  exit "$exit_code"
}

main "$@"

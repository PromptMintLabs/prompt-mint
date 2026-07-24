#!/usr/bin/env bash
# ── PromptHash Stellar — Dev Container Post-Create Command ────────────────
# Run once after the container is built to set up project dependencies.
#
# Pre-built image already contains: Node 22, Rust 1.89.0, Yarn 4.9.2,
#   wasm32v1-none target, Stellar CLI.
# This script installs frontend & server JS deps and validates the setup.
#
# Secrets (.env) are NEVER bundled into the image; the user must populate
# them after the container starts.
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  PromptHash Stellar — Dev Container Setup${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""

# ── 1. Bootstrap .env from template (secrets excluded from image) ────────
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠  Created .env from .env.example — fill in secrets before running.${NC}"
    echo -e "${YELLOW}   See docs/contributing.md for required values.${NC}"
  else
    echo -e "${RED}✖  .env.example not found. Cannot bootstrap environment.${NC}"
  fi
else
  echo -e "${GREEN}✔  .env already exists${NC}"
fi
echo ""

# ── 2. Install frontend dependencies (yarn) ───────────────────────────────
echo -e "${CYAN}⟳  Installing frontend dependencies (yarn install)...${NC}"
if yarn install 2>&1; then
  echo -e "${GREEN}✔  Frontend dependencies installed${NC}"
else
  echo -e "${YELLOW}⚠  yarn install had warnings — review above.${NC}"
fi
echo ""

# ── 3. Install server dependencies (npm) ──────────────────────────────────
if [ -d server ]; then
  echo -e "${CYAN}⟳  Installing server dependencies (npm install)...${NC}"
  if (cd server && npm install) 2>&1; then
    echo -e "${GREEN}✔  Server dependencies installed${NC}"
  else
    echo -e "${YELLOW}⚠  npm install had warnings — review above.${NC}"
  fi
else
  echo -e "${YELLOW}⚠  server/ directory not found — skipping server deps${NC}"
fi
echo ""

# ── 4. Validate environment ───────────────────────────────────────────────
echo -e "${CYAN}⟳  Validating environment (yarn check:setup --warn-only)...${NC}"
yarn check:setup --warn-only 2>&1 || true
echo ""

# ── 5. Summary ────────────────────────────────────────────────────────────
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Dev Container setup complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Next steps:${NC}"
echo -e "    1. ${YELLOW}Fill in .env secrets${NC}  (see docs/contributing.md)"
echo -e "    2. ${YELLOW}yarn dev${NC}              — Start the frontend (Vite)"
echo -e "    3. ${YELLOW}cd server && npm run dev${NC} — Start the backend (Express)"
echo -e "    4. ${YELLOW}yarn test:frontend${NC}     — Run frontend tests"
echo -e "    5. ${YELLOW}cargo test -p prompt-hash${NC} — Run contract tests"
echo ""

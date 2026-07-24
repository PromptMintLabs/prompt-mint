# PromptHash Stellar Dev Container
# Pins Node.js 22, Rust 1.89.0, Yarn 4.9.2, Stellar CLI
# Matches CI toolchain versions from .github/workflows/*.yml

FROM mcr.microsoft.com/devcontainers/base:debian-12

# ── Build arguments (pin all versioned tools) ──────────────────────────────
ARG NODE_MAJOR=22
ARG RUST_VERSION=1.89.0
ARG STELLAR_CLI_VERSION=22.3.0
ARG YARN_VERSION=4.9.2
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=${USER_UID}

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# ── 1. System dependencies ─────────────────────────────────────────────────
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        git \
        gnupg \
        libssl-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

# ── 2. Node.js and Yarn ────────────────────────────────────────────────────
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare yarn@${YARN_VERSION} --activate

# ── 3. Rust toolchain (pinned to project version) ──────────────────────────
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y \
        --default-toolchain ${RUST_VERSION} \
        --profile minimal \
    && rustup target add wasm32v1-none \
    && chmod -R a+w ${RUSTUP_HOME} ${CARGO_HOME}

# ── 4. Install Stellar CLI (pinned release) ────────────────────────────────
RUN cargo install stellar-cli --locked --version ${STELLAR_CLI_VERSION} --features opt \
    && rm -rf ${CARGO_HOME}/registry

# ── 5. Verify installations ─────────────────────────────────────────────────
RUN echo "Node:  $(node --version)" \
    && echo "Yarn:  $(yarn --version)" \
    && echo "Rust:  $(rustc --version)" \
    && echo "Stellar: $(stellar --version 2>&1 | head -1)"

# ── 6. Ensure non-root user owns home dirs for tool caches ─────────────────
RUN mkdir -p /home/${USERNAME}/.cargo /home/${USERNAME}/.npm \
    && chown -R ${USERNAME}:${USERNAME} /home/${USERNAME}

# ── 7. Switch to non-root user ─────────────────────────────────────────────
USER ${USERNAME}

ENV PATH="${CARGO_HOME}/bin:/home/${USERNAME}/.cargo/bin:${PATH}" \
    CARGO_HOME="${CARGO_HOME}" \
    RUSTUP_HOME="${RUSTUP_HOME}"

CMD ["/bin/bash"]

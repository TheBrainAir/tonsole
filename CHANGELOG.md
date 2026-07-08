# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Wallet contract version picker at create/import: **v5r1 (W5, default), v4r2, v3r2, v3r1** —
  `--contract <version>` in the CLI and a selection step in the TUI onboarding.
  v3 wallets support balances, history, receive and sends (GRAM, jettons, NFTs) with the
  emulation preview; TON Connect requires v4r2/v5r1.

## [0.1.0] — unreleased

Initial public release.

- Encrypted keystore (Argon2id + AES-256-GCM, Web3 Secret Storage v3), create/import wallets
- Balances (GRAM + jettons), send with emulation preview + confirmation, receive + QR
- Transaction history, NFTs (view + transfer), `.ton` DNS resolution, send-max
- TON Connect: approve dApp connections and transactions from the terminal
- Full-screen Ink TUI plus scriptable CLI (`--json`)
- Defaults to **testnet** on first run

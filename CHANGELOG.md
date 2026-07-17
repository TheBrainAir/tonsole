# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-07-17

Initial public release. Published to npm as `@thebrainair/tonsole` (the command is `tonsole`).

### Wallet & keys

- Encrypted keystore (Argon2id + AES-256-GCM, Web3 Secret Storage v3), create/import wallets
- Wallet contract picker at create/import: **v5r1 (W5, default)** and **v4r2**, via
  `--contract <version>` in the CLI and a selection step in the TUI onboarding

### Balances, transfers & history

- Balances (GRAM + jettons), send with emulation preview + confirmation, receive + QR
- Transaction history, NFTs (view + transfer), `.ton` DNS resolution, send-max

### Networks

- **Testnet and mainnet**, both first-class. Switch with `tonsole network use <network>` (persisted),
  the `-n/--network` flag (per command), or `TONSOLE_NETWORK` (per shell), and with <kbd>N</kbd> in the TUI
- **Wallets are network-scoped**: a wallet is refused on a network other than the one it was created on,
  rather than silently querying the wrong chain. The default wallet is tracked per network

### Interfaces

- Full-screen Ink TUI plus scriptable CLI (`--json`)
- TON Connect: approve dApp connections and transactions from the terminal

[Unreleased]: https://github.com/TheBrainAir/tonsole/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/TheBrainAir/tonsole/releases/tag/v0.1.0

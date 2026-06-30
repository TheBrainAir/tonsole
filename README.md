# tonsole

> Open-source TUI/CLI wallet for the [TON](https://ton.org) blockchain — manage your wallet right in the terminal.

`tonsole` is a convenient, keyboard-driven terminal wallet for TON. It ships both a full-screen
interactive **TUI** and scriptable **CLI** commands, built on the official
[TON WalletKit](https://docs.ton.org/applications/walletkit/overview) SDK.

**Status:** 🚧 active development — the **v1 core is functional** (milestones M0–M4). Create/import a wallet,
view GRAM + jetton balances, send GRAM and jettons with an emulation preview, receive with a QR, and browse
history — via both an interactive **TUI** (`tonsole`) and scriptable **CLI** commands. TON Connect and NFTs
are next.

> **GRAM vs TON:** the network's native coin was renamed Toncoin → **GRAM** (ticker GRAM) in June 2026.
> The blockchain itself is still **TON** (The Open Network), so addresses, TON Connect and the SDK keep the
> TON name; only the coin is labelled GRAM.

## Features (v1)

- Create / import a wallet from a 24-word recovery phrase, multiple accounts
- Encrypted keystore (Argon2id + AES-256-GCM), keys never leave your machine
- Balances for GRAM (the native coin) and jettons; view your NFTs; receive screen with a terminal QR code
- Send GRAM, jettons, and NFTs with a transaction emulation preview and confirmation
- Interactive transaction history (navigate, copy address/hash/memo, open in Tonviewer)
- TON Connect — connect to dApps and approve their connections/transactions from the terminal
- Testnet and mainnet (testnet by default on first run)

## Development

Requires **Node.js ≥ 22.12**.

```bash
npm install
npm run dev        # run the CLI/TUI from source via tsx
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest
npm run spike      # M0: verify @ton/walletkit works under Node
npm run build      # bundle with tsup -> dist/
```

## Security

Your recovery phrase is encrypted at rest with Argon2id + AES-256-GCM and stored under
`~/.config/tonsole/` with `0600` permissions. The passphrase is requested for each signing
operation and is never written to disk, logs, or shell history. `tonsole` is a software (hot)
wallet — use it on a trusted machine and keep large holdings in a hardware wallet.

## License

[MIT](./LICENSE) © the tonsole authors

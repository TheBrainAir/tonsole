# tonsole

> Open-source TUI/CLI wallet for the [TON](https://ton.org) blockchain — manage your wallet right in the terminal.

`tonsole` is a convenient, keyboard-driven terminal wallet for TON. It ships both a full-screen
interactive **TUI** and scriptable **CLI** commands, built on the official
[TON WalletKit](https://docs.ton.org/applications/walletkit/overview) SDK.

**Status:** 🚧 active development — the **v1 core is functional** (milestones M0–M4). Create/import a wallet,
view TON + jetton balances, send TON and jettons with an emulation preview, receive with a QR, and browse
history — via both an interactive **TUI** (`tonsole`) and scriptable **CLI** commands. TON Connect and NFTs
are next.

## Features (v1)

- Create / import a wallet from a 24-word recovery phrase, multiple accounts
- Encrypted keystore (Argon2id + AES-256-GCM), keys never leave your machine
- Balances for TON and jettons; receive screen with a terminal QR code
- Send TON and jettons with a transaction emulation preview and confirmation
- Transaction history
- Testnet and mainnet (testnet by default on first run)

TON Connect (approving dApp transactions from the terminal) and NFTs come in later milestones.

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

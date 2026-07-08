# tonsole

> Open-source TUI/CLI wallet for the [TON](https://ton.org) blockchain — manage your wallet right in the terminal.

`tonsole` is a convenient, keyboard-driven terminal wallet for TON. It ships both a full-screen
interactive **TUI** and scriptable **CLI** commands, built on the official
[TON WalletKit](https://docs.ton.org/applications/walletkit/overview) SDK.

**Status:** 🚧 active development — the **v1 feature set is functional** (milestones M0–M6). Create/import a
wallet, view GRAM + jetton balances, send GRAM, jettons and NFTs with an emulation preview, receive with a
QR, browse history, connect to dApps over **TON Connect**, and view/transfer NFTs — via both an interactive
**TUI** (`tonsole`) and scriptable **CLI** commands.

> ⚠️ **Experimental software — use at your own risk.** `tonsole` is provided "AS IS", without any warranty,
> and handling real funds carries risk. Please read the **[Disclaimer](./DISCLAIMER.md)** before use.

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

## Install

Requires **Node.js ≥ 22.12**.

```bash
npm install -g tonsole   # then run `tonsole` (no args) for the TUI, or a subcommand
tonsole --help
```

First run defaults to **testnet**. Try it there before switching to mainnet.

## Development

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

Your recovery phrase is encrypted at rest with **Argon2id + AES-256-GCM** and stored under
`~/.config/tonsole/` with `0600` permissions (keystore writes are atomic, with a `.bak` safety copy).
The passphrase is requested for each signing operation, held only transiently, and is never written to
disk or logs. The interactive prompts never echo your passphrase or recovery phrase, and `tonsole` never
copies secrets to the clipboard.

`tonsole` is a software (**hot**) wallet — use it on a trusted machine and keep large holdings in a
hardware wallet. Automation escape hatches expose secrets by design and should be avoided outside
throwaway/test wallets: passing the recovery phrase as arguments to `wallet import <words…>` puts it in
your shell history and process list (prefer the hidden prompt), `TONSOLE_PASSPHRASE` is readable from the
process environment, and `wallet create --json` prints the plaintext recovery phrase to stdout.

To report a vulnerability, see **[SECURITY.md](./SECURITY.md)**.

## Disclaimer

`tonsole` is free, open-source, experimental software provided **"AS IS", without warranty of any kind**.
It is **not affiliated with, endorsed by, or sponsored by** the TON Foundation, The Open Network, or any
exchange or third party. Nothing here is financial, investment, legal, or tax advice. You are solely
responsible for your keys, funds, and compliance with the laws of your jurisdiction. See the full
**[Disclaimer](./DISCLAIMER.md)**.

## License

[MIT](./LICENSE) © the tonsole authors. Third-party notices: [NOTICE](./NOTICE).

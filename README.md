# tonsole

> Open-source TUI/CLI wallet for the [TON](https://ton.org) blockchain — manage your wallet right in the terminal.

`tonsole` is a keyboard-driven terminal wallet for TON. It ships both a full-screen
interactive **TUI** and scriptable **CLI** commands, built on the official
[TON WalletKit](https://docs.ton.org/) SDK. It runs on **testnet and mainnet**.

> ⚠️ **Experimental software — use at your own risk.** `tonsole` is provided "AS IS", without any warranty,
> and handling real funds carries risk. Please read the **[Disclaimer](./DISCLAIMER.md)** before use.

> **GRAM vs TON:** the network's native coin was renamed Toncoin → **GRAM** (ticker GRAM) in June 2026.
> The blockchain itself is still **TON** (The Open Network), so addresses, TON Connect and the SDK keep the
> TON name; only the coin is labelled GRAM.

## Features

- Create / import a wallet from a 24-word recovery phrase, with multiple accounts
- Encrypted keystore (Argon2id + AES-256-GCM); keys never leave your machine
- Balances for GRAM and jettons; view your NFTs; receive screen with a terminal QR code
- Send GRAM, jettons, and NFTs with a transaction **emulation preview** and confirmation
- Interactive transaction history (navigate, copy address/hash/memo, open in Tonviewer)
- **TON Connect** — connect to dApps and approve their connections/transactions from the terminal
- **Testnet and mainnet**, switchable at any time — wallets are scoped to their network

## Install

Requires **Node.js ≥ 22.12**.

```bash
npm install -g @thebrainair/tonsole
tonsole            # launch the interactive TUI
tonsole --help     # list the CLI commands
```

Running `tonsole` with no arguments in a terminal opens the full-screen TUI. Any subcommand
(`tonsole balance`, `tonsole send …`) runs the scriptable CLI instead.

> **First run defaults to testnet.** Try everything there before switching to mainnet — see
> [Networks](#networks).

## Networks

`tonsole` supports both **testnet** (default) and **mainnet**. The active network is shown in the TUI
header and by `tonsole network`.

```bash
tonsole network                 # show the active network and your wallet counts
tonsole network use mainnet     # switch to mainnet (saved to config)
tonsole network use testnet     # switch back
```

You can also select a network for a single command with `-n/--network`, or for a shell session with the
`TONSOLE_NETWORK` environment variable:

```bash
tonsole -n mainnet balance          # this command only
TONSOLE_NETWORK=mainnet tonsole …   # every command in this shell (overrides the saved default)
```

In the **TUI**, press <kbd>N</kbd> to open the network picker (reachable even before you've created a
wallet).

### Wallets are per-network

A wallet is tied to the network it was created on. A **testnet wallet cannot be used on mainnet** (and
vice versa): its address is tagged for that chain, so `tonsole` refuses to operate it on the other one
rather than silently querying the wrong network. `tonsole wallet list` shows all your wallets and marks the
ones that are not on the active network.

The **same 24-word recovery phrase can be imported on both networks** — the keys are identical; only the
address encoding differs. So to hold "the same" wallet on mainnet and testnet, import the phrase once on
each:

```bash
tonsole network use testnet && tonsole wallet import   # enter the phrase at the prompt
tonsole network use mainnet && tonsole wallet import   # same phrase, now a mainnet wallet
```

## CLI

Every command accepts the global flags `-n, --network <mainnet|testnet>` and `--json` (machine-readable
output for scripting). `history`, `jettons`, and `nft` also accept a bare address, to inspect any account
without importing it.

| Command | What it does |
|---|---|
| `tonsole wallet create [--contract v5r1\|v4r2]` | Create a wallet + 24-word phrase (shown once) |
| `tonsole wallet import [--contract v5r1\|v4r2]` | Import from a 24-word phrase (enter at the hidden prompt) |
| `tonsole wallet list` | List all wallets, marking any not on the active network |
| `tonsole wallet use <id\|address>` | Set the default wallet (per network) |
| `tonsole wallet rename <id\|address> [label]` | Set or clear a wallet's label |
| `tonsole wallet remove <id\|address>` | Delete a keystore (irreversible — keep your phrase) |
| `tonsole network` | Show the active network and wallet counts |
| `tonsole network use <mainnet\|testnet>` | Switch and save the active network |
| `tonsole balance [account]` | Show the GRAM balance |
| `tonsole send <to> [amount]` | Send GRAM, a jetton (`--jetton`), or an NFT (`--nft`) |
| `tonsole receive [account]` | Show your address + a terminal QR (`--no-qr` to skip) |
| `tonsole jettons [account]` | List jetton (token) balances |
| `tonsole nft [account]` | List NFTs held by a wallet |
| `tonsole history [account] [-l <n>]` | Show recent transactions |

Every send is **emulated first**: `tonsole` shows the money flow and fees, and catches
insufficient-balance / failed-compute errors, *before* it ever asks for your passphrase.

```bash
tonsole send UQ…recipient 1.5                       # send 1.5 GRAM
tonsole send UQ…recipient max                       # send the whole balance
tonsole send UQ…recipient 10 --jetton EQ…usdtMaster # send 10 USDT
tonsole send UQ…recipient --nft EQ…itemAddress      # transfer an NFT
tonsole -n mainnet balance --json                   # scriptable output
```

## TUI

Launch with `tonsole` (no args). It's a full-screen app; the status bar always shows the keys available on
the current screen. Common keys:

| Key | Action |
|---|---|
| <kbd>↑</kbd>/<kbd>↓</kbd>, <kbd>Enter</kbd> | Move / select |
| <kbd>Esc</kbd> | Back |
| <kbd>N</kbd> | Switch network |
| <kbd>h</kbd> | History |
| <kbd>c</kbd> | Copy address |
| <kbd>o</kbd> | Open in explorer |
| <kbd>r</kbd> | Refresh |
| <kbd>q</kbd> | Quit |

From the dashboard you can open Send, Receive, Jettons, NFTs, History, Connect (TON Connect), and Accounts.

## Configuration

Config lives at `~/.config/tonsole/config.json` (or `$XDG_CONFIG_HOME/tonsole/`), written with `0600`
permissions. Everything is optional — the defaults work out of the box against TON's public endpoints.

| Setting | Env var | Default |
|---|---|---|
| Active network | `TONSOLE_NETWORK` | `testnet` |
| Engine (`auto`/`walletkit`/`toncore`) | `TONSOLE_ENGINE` | `auto` |
| TonCenter API key | `TONSOLE_TONCENTER_KEY` | none (public rate limits) |
| TonAPI key | `TONSOLE_TONAPI_KEY` | none (public rate limits) |

API endpoints can be overridden per network in `config.json` under `api.toncenter.url` / `api.tonapi.url`.
Set an API key if you hit rate limits.

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

## Development

```bash
npm install
npm run dev        # run the CLI/TUI from source via tsx
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest
npm run build      # bundle with tsup -> dist/
```

Contributions are welcome — see **[CONTRIBUTING.md](./CONTRIBUTING.md)** and our
**[Code of Conduct](./CODE_OF_CONDUCT.md)**. Manual end-to-end checks should run against **testnet**
(never mainnet, never a real key).

## Disclaimer

`tonsole` is free, open-source, experimental software provided **"AS IS", without warranty of any kind**.
It is **not affiliated with, endorsed by, or sponsored by** the TON Foundation, The Open Network, or any
exchange or third party. Nothing here is financial, investment, legal, or tax advice. You are solely
responsible for your keys, funds, and compliance with the laws of your jurisdiction. See the full
**[Disclaimer](./DISCLAIMER.md)**.

## License

[MIT](./LICENSE) © the tonsole authors. Third-party notices: [NOTICE](./NOTICE).

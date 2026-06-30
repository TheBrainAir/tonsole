# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`tonsole` — an open-source TUI/CLI wallet for the TON blockchain, built on the official
**TON WalletKit** (`@ton/walletkit`). It ships a full-screen interactive **Ink TUI** (default) plus
scriptable **Commander CLI** commands. **ESM-only, Node ≥ 22.12, React 19** (forced by Ink 7 + commander 15).

Status: the **v1 core is functional — milestones M0–M4 are complete**: encrypted keystore + create/import,
balances (GRAM + jettons), send (GRAM + jettons) with an emulation preview + confirmation, receive + QR,
transaction history, a full interactive **Ink TUI** (`src/tui/`) plus the scriptable CLI, and **TON
Connect** (approve dApp connections/transactions from the terminal). M6 (NFTs + packaging) remains. See
the roadmap below.

## Commands

```bash
npm run dev         # run from source via tsx (the only correct way to run during dev — see gotcha)
npm run build       # bundle to dist/ with tsup (esbuild); produces the `tonsole` bin
npm run typecheck   # tsc --noEmit (strict, NodeNext)
npm run lint        # eslint (flat config); enforces the architectural import boundary
npm test            # vitest run
npm run test:watch  # vitest watch
npm run spike       # M0: prove @ton/walletkit works under Node (see spike/FINDINGS.md)

# run a single test file / test by name:
npx vitest run src/domain/amount.test.ts
npx vitest run -t "parses 1.5 TON"
```

Testnet integration tests are opt-in and gated behind `TONSOLE_TEST_TESTNET=1` (they hit a real
faucet/testnet; never run them against mainnet, never use a real key).

## Critical gotcha: how `@ton/walletkit` loads

`@ton/walletkit@1.0.0`'s published build is broken for plain Node: its ESM uses extensionless/directory
relative imports raw Node can't resolve, and Node can't statically bind its *named* exports. So
`src/engine/walletkit/WalletKitEngine.ts` loads it with a **top-level-await dynamic import**
(`const wk = await import('@ton/walletkit')`), which yields the full namespace. Consequences:

- **Do NOT** `import { X } from '@ton/walletkit'` or `import * as wk from '@ton/walletkit'` statically —
  both fail at runtime (named-binding error / `wk.Network` undefined). Always go through the dynamic import.
- **dev** runs via `tsx` (its esbuild loader fixes walletkit's internal resolution).
- **prod** is a `tsup` bundle that **bundles** walletkit via `noExternal: ['@ton/walletkit']` in
  `tsup.config.ts`, so esbuild inlines and fixes it — `node dist/index.js` then works. `@ton/core`,
  `@ton/crypto`, `@ton/ton` stay external (well-formed, shared at runtime); `argon2` stays external (native).
- The ESM bundle needs a `require` shim (createRequire banner in `tsup.config.ts`) because a bundled CJS
  dep (tweetnacl) calls `require('crypto')`.
- The TON Connect bridge (SSE) works under Node via `@tonconnect/isomorphic-eventsource` (walletkit's
  own dep) — **no** global EventSource polyfill is needed. Do not add an `eventsource` dependency: it
  gets externalized by tsup and the bundled bridge then resolves it (v4, no default export) instead of
  isomorphic-eventsource's `eventsource@2`, breaking the bundle. Core wallet ops use `fetch` (Node 22).

`spike/FINDINGS.md` records the verified WalletKit API (real export names, adapter shapes, reusable
helpers like `parseUnits`/`formatUnits`/`isValidAddress`/`getJettonsFromClient`/`ApiClientToncenter`).
Read it before writing anything in `src/engine/walletkit/`.

## Architecture: hexagonal (ports & adapters)

The whole design exists to keep the UI decoupled from any single SDK. **The `WalletEngine` port
(`src/engine/WalletEngine.ts`) is the load-bearing seam.** UI/CLI → services → ports → adapters.

```
tui ─┐                      ┌─ secrets (KeystorePort)
     ├─► services ─► ports ─┼─ engine   (WalletEngine: walletkit | toncore)
cli ─┘        │             └─ network  (IndexerPort: tonapi | toncenter)
             ▼
          domain  (pure: address / amount / mnemonic / jetton)
```

- **Two interchangeable engines implement `WalletEngine`:** `engine/walletkit/` (primary,
  `@ton/walletkit`) and `engine/toncore/` (fallback, `@ton/ton` + `@ton/crypto`). Because `@ton/core`
  and `@ton/crypto` are WalletKit **peer dependencies**, both engines derive **byte-identical** keys and
  addresses from the same mnemonic — an account is portable between engines. `engine/factory.ts` selects
  one (`auto|walletkit|toncore`); the spike verdict made `walletkit` the default. Swapping engines is a
  one-line change in the factory and changes **no** UI/service code. The only walletkit-exclusive feature
  is TON Connect (M5), which degrades to "unavailable" under the fallback.
- **Domain types are engine-agnostic** (`src/engine/types.ts`): addresses are normalized strings (+
  workchain), amounts are `bigint` in smallest units (never floats), and built transactions carry an
  opaque `raw: unknown` that services/UI must never inspect (round-tripped build→preview→sign→send).
- **`src/composition.ts` is the composition root**: it wires config → keystore → engine(factory) →
  indexer → services and hands the bundle to either the TUI or the CLI. This is the only place
  implementations are bound to ports.
- **The send pipeline always emulates before signing:** `buildTransfer → preview (emulation, money-flow +
  fees) → confirm → sign → send`. Insufficient-balance and failed-compute are caught at `preview`, before
  any passphrase prompt. Keep this ordering — it is the core safety property.

### Enforced import boundary

`eslint.config.js` has `no-restricted-imports` rules: **`src/tui/**` and `src/cli/**` may import only
`services/`, `domain/`, `config/`, `shared/`** — never `engine/walletkit/**`, `engine/toncore/**`,
`secrets/Argon*`, `network/**`, `argon2`, or `@ton/*`. If you need chain/crypto/keystore behavior in the
UI, go through a service. This compiler-enforces the seam; do not weaken it.

## Security model (keystore)

- The single place that touches plaintext mnemonics and native `argon2` is `src/secrets/` (esp.
  `ArgonKeystore.ts`). Encrypt the 24-word phrase with **Argon2id (m=64MB,t=3,p=4) → AES-256-GCM**, stored
  as **Web3 Secret Storage v3 JSON** + TON metadata under `~/.config/tonsole/keystore/` (dir `0700`,
  files `0600`, validated on load).
- **Key derivation is TON-specific** (`@ton/crypto`: PBKDF2-HMAC-SHA512, salt "TON default seed",
  ed25519) — **not** standard BIP39 seed derivation. The keystore only encrypts the mnemonic string; the
  engine derives keys. Never validate/derive a TON mnemonic with `@scure/bip39`'s seed functions.
- Passphrase is prompted per signing (no-echo), held in a `SecretString` for minimal time, never logged
  or passed via argv. Node can't guarantee memory zeroing — this is acknowledged, not solved.

## Addresses & amounts (easy to get wrong)

- **Coin name:** the native coin was renamed Toncoin → **GRAM** (June 2026); the blockchain/network is still
  **TON**. Label the coin **GRAM** in user-facing output via `COIN_SYMBOL` / `formatCoin` (`src/domain/amount.ts`);
  keep **TON** for addresses, TON Connect, `@ton/*`, and network names. Internally the native asset
  discriminant is still `'TON'` (`Asset = 'TON' | {...}`) — only the *display* says GRAM.
- The native coin has **9 decimals** (nanotons). Jettons have **variable decimals** (USDT = 6) — always resolve
  `decimals` from indexer metadata before formatting or building a transfer; never hardcode 9.
- Compare/store addresses by **raw form** (`0:…`). For display use the **non-bounceable `UQ…`** form for
  wallets (WalletKit returns this by default). `EQ` (bounceable) vs `UQ` of the same account differ only
  by a flag + CRC — they are the same account.

## Roadmap (milestones)

M0 scaffold + spike ✅ → M1 keystore + create/import + balance + receive ✅ → M2 send TON (emulate/confirm) +
history ✅ → M3 jettons ✅ → **M4 full Ink TUI = v1 ✅** → M5 TON Connect ✅ → M6 NFTs + npm packaging.
The TUI launches on `tonsole` with no args (a real TTY); CLI subcommands otherwise. `src/tui/run.tsx` is a
dynamic import so CLI commands don't load Ink.
Default wallet contract is **W5 (v5r1)**; v4r2 is supported for import. Network defaults to **testnet** on
first run. The full plan lives at `~/.claude/plans/mighty-singing-cloud.md`.

## Packaging note

Distribution is a normal global npm package (`npm i -g tonsole`), **not** a single binary: `argon2` is a
native `node-gyp-build` addon and can't be statically inlined. `tsup` bundles `src/` and keeps `argon2`,
`@ton/*`, `ink`, `react`, `clipboardy` **external** (installed by npm).

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`tonsole` — an open-source TUI/CLI wallet for the TON blockchain, built on the official
**TON WalletKit** (`@ton/walletkit`). It ships a full-screen interactive **Ink TUI** (default) plus
scriptable **Commander CLI** commands. **ESM-only, Node ≥ 22.12, React 19** (forced by Ink 7 + commander 15).

Status: the **v1 core is functional — milestones M0–M4 are complete**: encrypted keystore + create/import,
balances (GRAM + jettons), send (GRAM + jettons) with an emulation preview + confirmation, receive + QR,
transaction history, a full interactive **Ink TUI** (`src/tui/`) plus the scriptable CLI, **TON Connect**
(approve dApp connections/transactions from the terminal), and **NFTs** (view + transfer). The v1 feature
set is complete; remaining work is polish and the npm publish. See the roadmap below.

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

Manual end-to-end checks run against **testnet** (never mainnet, never a real key). There is no
automated testnet integration suite yet.

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
- WalletKit's logger writes to the **console** (default level ERROR) and would corrupt the full-screen
  Ink TUI. `WalletKitEngine.ts` sets `process.env.WALLETKIT_LOG_LEVEL ??= 'none'` **before** the dynamic
  import to silence it; user-facing errors are surfaced through our own handlers, not the console.
- WalletKit's TON Connect validation hard-requires **friendly** message addresses and rejects raw
  `0:<hex>` ones (which the spec allows), killing dApps like minter.ton.org *before* the approval prompt.
  The kit validates events read back from its storage adapter, so `WalletKitEngine.#normalizingStorage`
  wraps `MemoryStorageAdapter` and `tonconnect-normalize.ts` rewrites raw→friendly message addresses on
  write (non-bounceable when a stateInit is present); the top-level `from` is left raw (compared with
  `Address.equals`).

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

## TUI architecture (fullscreen Ink shell)

The TUI is a **fullscreen alternate-screen app** (Ink 7.1 `alternateScreen: true` in `src/tui/run.tsx`;
incrementalRendering stays OFF — its line diff corrupts on resize). Key structures:

- **`src/tui/theme.ts`** — ALL visual tokens (colors, borders, symbols, spacing, breakpoints). Never
  hardcode a color/border literal in `src/tui/**`; add a token.
- **`src/tui/shell/`** — `viewport.tsx` (`useViewport()`: columns/rows/breakpoint/`contentRows`; the ONLY
  consumer of `useWindowSize`; fluid fallback pins rows in tests), `keymap.tsx` (layered key dispatch:
  `app` < `screen` < `overlay`; the newest active overlay masks everything below — this replaced the old
  `modalOpen` flag; the status bar renders hints from the same registrations), `AppShell.tsx` (persistent
  Header + StatusBar around every stage; **clips** overly tall screens via `overflowY="hidden"` +
  `flexShrink={0}` — without the shrink-0 wrapper yoga *squeezes* rows and text overlaps),
  `StatusBar.tsx` (also `useFlash()` — transient "✓ copied" messages).
- **Component kit** (`src/tui/components/`): `Panel` (the one bordered box), `ListView` (the one
  selectable windowed list — sizes itself from `contentRows` via `reservedRows`), `Spinner`/`AsyncView`
  (loading→error→empty→data ladder), `TextField` (cursor editing + bracketed paste, paste goes through
  `sanitizeText`), `CenteredModal`+`ConfirmBar` (modal = hidden screen via `display:none` + overlay keymap
  scope), `Badge`, `EmptyState`. Jettons/NFTs share one `screens/GalleryScreen.tsx` (adapter pattern).
- **Rules**: screens declare hotkeys via `useKeymap('screen', …)` — never a raw `useInput` for hotkeys
  (hints and masking come for free). Never keep single-letter bindings active while a TextField has focus.
  Components owning their own `useInput`/`usePaste` must gate with `useInputGate(...)`. Root width must
  stay `"100%"` (an absolute width lags one commit on resize and emits wrapped lines that corrupt the
  frame). `AppShell` clips vertical overflow — put must-see content (e.g. the 24 mnemonic words) at the
  TOP of a panel.

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
history ✅ → M3 jettons ✅ → **M4 full Ink TUI = v1 ✅** → M5 TON Connect ✅ → M6 NFTs ✅ (view + transfer).
The `tonsole` bin + tsup bundle are publishable as **`@thebrainair/tonsole`** (`npm i -g @thebrainair/tonsole`;
the bare name `tonsole` was already taken on npm). The command stays `tonsole`. The actual npm publish runs
from CI on a `v*` tag (`.github/workflows/release.yml`), not locally — `publishConfig.provenance` makes a
local publish fail by design. The TUI launches on `tonsole` with no args (a real TTY); CLI subcommands
otherwise. `src/tui/run.tsx` is a dynamic import so CLI commands don't load Ink.
Default wallet contract is **W5 (v5r1)**; **v4r2** is also selectable at create/import (CLI
`--contract v5r1|v4r2`, TUI onboarding picker). Both support TON Connect. `WALLET_VERSIONS` in
`src/engine/types.ts` is the single source of the supported set (v3 is not supported — WalletKit has no v3
adapter).

**Networks are first-class and wallet-scoping is a safety property.** `config.network` is the active
network (source of truth for behavior); every keystore records its own `network`. `AccountService.list()`
filters to the active network and `resolve()` throws `NetworkMismatch` for an off-network wallet — so a
testnet wallet can never silently transact on mainnet. `listAll()`/`find()` are the network-blind
lookups for display and local metadata ops (rename/remove). The default wallet is per-network
(`config.defaultAccounts`, with the pre-0.1 flat `defaultAccount` read as a fallback). Switch persistently
with `tonsole network use <n>` (CLI) or <kbd>N</kbd> (TUI, which rebuilds the engine in `run.tsx`);
`TONSOLE_NETWORK` overrides the saved default per shell, and the switch code warns rather than lying when
it is set. Network defaults to **testnet** on first run.

## Packaging note

Distribution is a normal global npm package (`npm i -g @thebrainair/tonsole`), **not** a single binary: `argon2` is a
native `node-gyp-build` addon and can't be statically inlined. `tsup` bundles `src/` and keeps `argon2`,
`@ton/*`, `ink`, `react`, `clipboardy` **external** (installed by npm).

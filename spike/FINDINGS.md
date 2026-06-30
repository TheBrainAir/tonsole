# M0 spike findings — `@ton/walletkit` under Node

Run: `npm run spike` (executes `spike/walletkit-node.ts` via tsx). Date: 2026-06-29.
Environment: Node 22.14, `@ton/walletkit@1.0.0`, `@ton/core@0.63.1`, `@ton/crypto@3.3.0`, `@ton/ton@16.3.0`.

## Verdict

**WalletKit is usable under Node with our toolchain. Default engine = `walletkit`.**
The `TonCoreEngine` fallback is retained as insurance but is not required. 19/23 checks passed;
the 4 "failures" are all non-blocking (see below).

## Load mechanics (important)

- `@ton/walletkit@1.0.0`'s **published ESM build uses extensionless relative imports**
  (`./core/TonWalletKit` instead of `…/TonWalletKit.js`). Raw `node` ESM resolution **rejects** this
  (`ERR_MODULE_NOT_FOUND`). **However, `tsx` (dev) and `tsup`/esbuild (build) resolve it fine** — both
  are esbuild-based and lenient about extensions. ✅ Our dev and build paths both work.
- The **CJS build loads cleanly** via `createRequire(import.meta.url)('@ton/walletkit')` (136 exports) —
  a guaranteed fallback if we ever run under raw node ESM.
- **Action:** never depend on raw `node path.js` importing walletkit ESM directly. Run via tsx in dev;
  ship a tsup bundle in prod (esbuild inlines/resolves it). If a raw-node entry is ever needed, import
  the CJS entry.

## Update — M1 integration resolution (how we actually load it)

Empirically, under raw Node only **dynamic `import()`** and `require()` (CJS) return the full namespace;
static `import { X }` throws a named-binding error and static `import * as wk` yields `wk.Network ===
undefined` under tsx. The working, dual-runtime approach the engine uses:

- `const wk = await import('@ton/walletkit')` (top-level await) in `WalletKitEngine.ts`.
- `tsup.config.ts` sets `noExternal: ['@ton/walletkit']` so esbuild **bundles** it for the prod bin
  (tsup externalizes package.json deps by default; without this the broken build leaks to runtime).
- A createRequire `require` banner in `tsup.config.ts` (bundled CJS dep `tweetnacl` calls `require('crypto')`).
- `@ton/core`/`@ton/crypto`/`@ton/ton` and `argon2` stay external.

Verified: `tsx src/index.ts …` and `node dist/index.js …` both create a wallet and read a live testnet
balance.

## Real API (use these exact names in `engine/walletkit/*`)

- Construction: `new TonWalletKit({ deviceInfo, walletManifest, storage, networks, bridge })` + `await kit.waitForReady()`.
  - Helpers: **`createDeviceInfo(...)`**, **`createWalletManifest(...)`** (NOT `getTonConnect*` — those don't exist).
  - Storage adapters exported: **`MemoryStorageAdapter`**, `LocalStorageAdapter`, `ExtensionStorageAdapter`,
    plus a `Storage`/`StorageError` base. For the CLI use `MemoryStorageAdapter` (sessions ephemeral); a
    small filesystem adapter implementing the storage interface can give durable TON Connect sessions in M5.
  - `networks` is keyed by chain id: `{ [Network.testnet().chainId]: { apiClient: { url, key? } } }`.
  - API clients exported: `ApiClientToncenter`, `ApiClientTonApi`.
- Signer: **`Signer.fromMnemonic(words, { type: 'ton' })`** → object with **`{ sign, publicKey }`**, `publicKey` hex `0x…`.
- Adapters: **`WalletV5R1Adapter.create(signer, { network })`** and `WalletV4R2Adapter`.
  - Returned adapter shape: `{ signer, config, domain, walletContract, client, publicKey, version, address }`.
  - `adapter.address.toString()` returns the **non-bounceable `UQ…`** form by default (correct display form for wallets).
- Kit instance managers (on the constructed object): `walletManager, sessionManager, eventRouter,
  requestProcessor, networkManager, jettonsManager, swapManager, streamingManager, stakingManager,
  gaslessManager, initializer, eventProcessor`.
- Handy reusable helpers (avoid reinventing): `parseUnits`, `formatUnits`, `isValidAddress`,
  `formatWalletAddress`, `asAddressFriendly`, `compareAddress`, `getJettonsFromClient`,
  `getJettonBalanceFromClient`, `getJettonWalletAddressFromClient`, `getNftsFromClient`, `getNftFromClient`,
  `createTransferTransaction`, `createJettonTransferPayload`, `createNftTransferPayload`,
  `createCommentPayload`, `getNormalizedExtMessageHash`, `getTransactionStatus`, `withTimeout`,
  `MnemonicToKeyPair`, `CreateTonMnemonic`.

## Correctness: cross-engine derivation CONFIRMED

Same 24-word mnemonic:
- `@ton/ton` `WalletContractV5R1` → `EQBfBlddiaxlpNgkKlBOvEcBai7TnoaJBq8ROWl8s3ZsiaUV` (bounceable EQ)
- WalletKit `WalletV5R1Adapter` → `UQBfBlddiaxlpNgkKlBOvEcBai7TnoaJBq8ROWl8s3ZsifjQ` (non-bounceable UQ)

These are the **same account** (identical account-id body `BfBlddiaxlpNgkKlBOvEcBai7TnoaJBq8ROWl8s3Zsi`);
they differ only by the bounceable flag (and thus CRC). The spike's equality check was a false negative
because it compared friendly forms with different bounce flags.
**Action for the engine:** compare/store addresses by **raw form** (`Address.toRawString()` / `0:…`) and
render with an explicit bounce flag (non-bounceable `UQ` for wallet display, per TON guidance).

## Non-blocking failures observed

1. `globalThis.EventSource` absent in Node → only needed for the TON Connect bridge (M5). Add the
   `eventsource` (or `undici`-based) polyfill at that milestone; core wallet ops use `fetch` (present).
2. `getTonConnectDeviceInfo` / `getTonConnectWalletManifest` not found → real names are
   `createDeviceInfo` / `createWalletManifest`.
3. Address-equality check → false negative (bounce-flag rendering, see above).

## Implications for the build

- `engine/walletkit/WalletKitEngine.ts` can be the primary implementation; construct the kit once with
  `MemoryStorageAdapter` and the configured network's TonCenter `apiClient`.
- Reuse WalletKit's `parseUnits`/`formatUnits`/`isValidAddress`/jetton+nft client helpers rather than
  hand-rolling them in `domain/*` where they fit.
- Keep `engine/toncore/*` (using `@ton/ton` `WalletContractV5R1`/`WalletContractV4`) as the fallback; its
  math matches WalletKit exactly, so an account is portable between engines.

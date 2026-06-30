/**
 * Engine-agnostic domain types shared by every WalletEngine implementation
 * (WalletKit and the TON-core fallback) and by all services and UI.
 *
 * Hard rules that keep the engine seam clean:
 *  - Addresses are normalized strings (+ workchain), never @ton/core `Address` objects.
 *  - Amounts are `bigint` in the smallest indivisible unit (nanotons for TON, raw
 *    units for jettons), never floats.
 *  - `raw: unknown` fields carry an engine-private object round-tripped through
 *    build -> preview -> sign -> send; services and UI must never inspect them.
 */

export type NetworkId = 'mainnet' | 'testnet';

/** Wallet contract version. W5 (v5r1) is the default; v4r2 is supported for import. */
export type WalletVersion = 'v5r1' | 'v4r2';

/** A derivable/deployed account. The engine derives this but persists no secrets. */
export interface AccountRef {
  /** User-friendly, bounceable, network-tagged form (EQ/UQ/kQ/0Q…). */
  address: string;
  /** Canonical raw form, e.g. "0:abcd…". */
  rawAddress: string;
  /** 0 = basechain, -1 = masterchain. */
  workchain: number;
  version: WalletVersion;
  /** Public key, hex (no 0x). */
  publicKey: string;
  network: NetworkId;
}

/** Native TON balance. Always 9 decimals (nanotons). */
export interface Balance {
  nano: bigint;
  decimals: 9;
}

/** A jetton holding. Decimals are token-specific and MUST come from metadata. */
export interface JettonBalance {
  /** Jetton master (minter) address, user-friendly form. */
  master: string;
  /** The owner's jetton wallet address. */
  walletAddress: string;
  /** Raw amount in the jetton's smallest unit. */
  amount: bigint;
  decimals: number;
  symbol?: string;
  name?: string;
  image?: string;
  verified?: boolean;
}

/** What the UI submits to build a transfer. */
export type TransferIntent =
  | { kind: 'ton'; to: string; amount: bigint; comment?: string; bounce?: boolean }
  | {
      kind: 'jetton';
      jettonMaster: string;
      to: string;
      amount: bigint;
      /** Resolved from metadata before building — never assume 9. */
      decimals: number;
      comment?: string;
      forwardTon?: bigint;
    }
  | { kind: 'nft'; nftAddress: string; to: string; comment?: string; forwardTon?: bigint };

/** A built but unsigned transfer. `raw` is the engine's private object. */
export interface UnsignedTransfer {
  intent: TransferIntent;
  /** Unix seconds; set by the engine if the wallet message has an expiry. */
  validUntil?: number;
  raw: unknown;
}

/** An asset referenced in money-flow/history: native TON or a specific jetton. */
export type Asset = 'TON' | { jettonMaster: string; symbol?: string; decimals: number };

/** A single signed change to one asset from our account's point of view. */
export interface AssetDelta {
  asset: Asset;
  /** Signed raw amount: negative = leaving us, positive = arriving. */
  amount: bigint;
  counterparty?: string;
}

/** Net asset movement produced by emulation; drives the confirmation screen. */
export interface MoneyFlow {
  outgoing: AssetDelta[];
  incoming: AssetDelta[];
}

export interface FeeBreakdown {
  gas: bigint;
  forward: bigint;
  storage: bigint;
  total: bigint;
}

/** Result of emulating a transfer before broadcasting. */
export interface TxPreview {
  /** True if emulation succeeded (compute phase did not abort). */
  ok: boolean;
  moneyFlow: MoneyFlow;
  /** Itemized fees when the provider exposes them; otherwise omitted. */
  estimatedFees?: FeeBreakdown;
  /** Whether sending also deploys the sender's wallet contract (first outgoing tx). */
  willDeployWallet: boolean;
  /** Human-readable cautions, e.g. "recipient is uninitialized; using non-bounceable". */
  warnings: string[];
  /** Non-zero compute-phase exit code, when emulation reports one. */
  exitCode?: number;
  raw: unknown;
}

export interface SignedTransaction {
  raw: unknown;
  /** Base64-encoded external message BOC, when the engine exposes it. */
  bocBase64?: string;
}

export interface SendResult {
  /** Normalized transaction/message hash, when available. */
  hash?: string;
  status: 'submitted' | 'confirmed';
  explorerUrl?: string;
}

/**
 * A parsed history entry. NOT served by WalletKit — engines delegate to the
 * IndexerPort (TonAPI) and normalize into this shape.
 */
export interface HistoryItem {
  hash: string;
  /** Unix seconds. */
  timestamp: number;
  direction: 'in' | 'out' | 'self';
  asset: Asset;
  amount: bigint;
  counterparty?: string;
  comment?: string;
  status: 'success' | 'failed';
  fee?: bigint;
}

/** Cursor-paginated result set. */
export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

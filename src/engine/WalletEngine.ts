import type {
  AccountRef,
  Balance,
  HistoryItem,
  JettonBalance,
  NetworkId,
  Page,
  SendResult,
  SignedTransaction,
  TransferIntent,
  TxPreview,
  UnsignedTransfer,
  WalletVersion,
} from './types.js';

/**
 * Supplies signing material to the engine transiently, for the lifetime of one
 * call. The implementation (keystore-backed) prompts for the passphrase, decrypts
 * the mnemonic, hands the words to `fn`, then best-effort zeroizes them.
 *
 * The engine receives plaintext only inside `fn`; it never persists secrets.
 */
export interface SigningContext {
  withMnemonic<T>(fn: (words: string[]) => Promise<T>): Promise<T>;
}

export interface CreateOpts {
  network: NetworkId;
  /** Defaults to 'v5r1' (W5). */
  version?: WalletVersion;
  /** Defaults to 0 (basechain). */
  workchain?: number;
}

/**
 * THE decoupling seam. WalletKitEngine and TonCoreEngine implement this
 * identically; the TUI/CLI and services depend ONLY on this interface, so the
 * engine can be swapped (config / spike outcome) without touching any caller.
 *
 * Because @ton/core and @ton/crypto are WalletKit peer dependencies, both
 * engines derive byte-identical addresses and keys from the same mnemonic — an
 * account created under one engine is fully usable under the other.
 */
export interface WalletEngine {
  readonly id: 'walletkit' | 'toncore';

  /** Warm up (e.g. WalletKit `waitForReady()`); call once before use. */
  init(): Promise<void>;
  /** Release resources (bridge connections, timers). */
  dispose(): Promise<void>;

  // ---- key/account derivation (no secrets persisted by the engine) ----
  /** Generate a fresh 24-word TON mnemonic. */
  generateMnemonic(): Promise<string[]>;
  /** Validate a 24-word TON mnemonic (TON-specific scheme, not BIP39 seed). */
  validateMnemonic(words: string[]): Promise<boolean>;
  /** Derive the wallet account (address + public key) from a mnemonic. */
  deriveAccount(mnemonic: string[], opts: CreateOpts): Promise<AccountRef>;

  // ---- reads ----
  getBalance(acct: AccountRef): Promise<Balance>;
  getJettons(acct: AccountRef): Promise<JettonBalance[]>;
  getHistory(acct: AccountRef, cursor?: string, limit?: number): Promise<Page<HistoryItem>>;

  // ---- write pipeline: build -> preview(emulate) -> sign -> send ----
  buildTransfer(acct: AccountRef, intent: TransferIntent): Promise<UnsignedTransfer>;
  /** Emulate the built transfer; returns money-flow + fees BEFORE any signing. */
  preview(acct: AccountRef, tx: UnsignedTransfer): Promise<TxPreview>;
  sign(acct: AccountRef, tx: UnsignedTransfer, ctx: SigningContext): Promise<SignedTransaction>;
  send(acct: AccountRef, signed: SignedTransaction): Promise<SendResult>;

  /**
   * Optional high-level saga for engines (WalletKit) that need the signer present
   * for the whole build -> emulate -> send flow. `onPreview` receives the emulated
   * money-flow; returning false aborts before anything is broadcast.
   */
  transfer?(
    acct: AccountRef,
    intent: TransferIntent,
    ctx: SigningContext,
    onPreview?: (preview: TxPreview) => Promise<boolean>,
  ): Promise<SendResult>;
}

import { generateMnemonic, validateMnemonic } from '../../domain/mnemonic.js';
import { AppError } from '../errors.js';
import type { WalletEngine } from '../WalletEngine.js';
import type {
  AccountRef,
  Balance,
  HistoryItem,
  JettonBalance,
  NetworkId,
  Page,
  SendResult,
  SignedTransaction,
  TxPreview,
  UnsignedTransfer,
} from '../types.js';

export interface TonCoreEngineDeps {
  network: NetworkId;
  toncenterUrl: string;
  toncenterKey?: string;
}

/**
 * Fallback engine built directly on @ton/ton + @ton/crypto + @ton/core. It exists
 * so the wallet keeps working if @ton/walletkit ever stops loading under Node.
 *
 * The M0 spike confirmed WalletKit works today, so this is intentionally a stub
 * for now (only mnemonic generation/validation, which are pure @ton/crypto). Its
 * read/transfer methods are filled in if/when the fallback is actually needed; the
 * derivation math is identical to WalletKit's, so accounts remain portable.
 */
export class TonCoreEngine implements WalletEngine {
  readonly id = 'toncore' as const;

  constructor(_deps: TonCoreEngineDeps) {}

  async init(): Promise<void> {}
  async dispose(): Promise<void> {}

  generateMnemonic(): Promise<string[]> {
    return generateMnemonic();
  }

  validateMnemonic(words: string[]): Promise<boolean> {
    return validateMnemonic(words);
  }

  async deriveAccount(): Promise<AccountRef> {
    return this.#unavailable();
  }
  async getBalance(): Promise<Balance> {
    return this.#unavailable();
  }
  async getJettons(): Promise<JettonBalance[]> {
    return this.#unavailable();
  }
  async getHistory(): Promise<Page<HistoryItem>> {
    return this.#unavailable();
  }
  async buildTransfer(): Promise<UnsignedTransfer> {
    return this.#unavailable();
  }
  async preview(): Promise<TxPreview> {
    return this.#unavailable();
  }
  async sign(): Promise<SignedTransaction> {
    return this.#unavailable();
  }
  async send(): Promise<SendResult> {
    return this.#unavailable();
  }

  #unavailable(): never {
    throw new AppError(
      'EngineUnsupported',
      'The TonCore fallback engine is not implemented yet — use the WalletKit engine (the default).',
    );
  }
}

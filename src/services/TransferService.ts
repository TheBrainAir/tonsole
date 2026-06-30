import { NETWORKS } from '../config/networks.js';
import { AppError } from '../engine/errors.js';
import type { WalletEngine } from '../engine/WalletEngine.js';
import type { SendResult, TxPreview } from '../engine/types.js';
import type { SecretString } from '../secrets/secret-string.js';
import type { AccountService } from './AccountService.js';

export interface SendTonParams {
  to: string;
  /** Amount in nanotons. */
  amount: bigint;
  comment?: string;
  /** Sender wallet id/address; defaults to the default wallet. */
  from?: string;
  passphrase: SecretString;
  /** Invoked with the emulated preview; return false to abort before broadcast. */
  confirm: (preview: TxPreview) => Promise<boolean>;
}

export interface SentTon extends SendResult {
  explorerUrl?: string;
}

/** Orchestrates the send saga across keystore (signing) and engine (emulate/send). */
export class TransferService {
  constructor(
    private readonly engine: WalletEngine,
    private readonly accounts: AccountService,
  ) {}

  async sendTon(params: SendTonParams): Promise<SentTon> {
    if (!this.engine.transfer) {
      throw new AppError('EngineUnsupported', 'The active engine cannot send transactions yet.');
    }
    const stored = this.accounts.resolve(params.from);
    const ctx = this.accounts.signingContext(stored, params.passphrase);
    const result = await this.engine.transfer(
      stored.account,
      { kind: 'ton', to: params.to, amount: params.amount, comment: params.comment },
      ctx,
      params.confirm,
    );
    const explorerUrl = result.hash
      ? NETWORKS[stored.account.network].explorerTx(result.hash)
      : undefined;
    return { ...result, explorerUrl };
  }
}

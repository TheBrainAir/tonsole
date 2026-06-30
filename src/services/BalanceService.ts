import type { WalletEngine } from '../engine/WalletEngine.js';
import type { AccountRef, Balance, JettonBalance } from '../engine/types.js';
import type { IndexerPort } from '../network/IndexerPort.js';

/** Reads balances: native TON from the engine, jetton balances from the indexer. */
export class BalanceService {
  constructor(
    private readonly engine: WalletEngine,
    private readonly indexer: IndexerPort,
  ) {}

  getTon(account: AccountRef): Promise<Balance> {
    return this.engine.getBalance(account);
  }

  getJettons(account: AccountRef): Promise<JettonBalance[]> {
    return this.indexer.getJettons(account);
  }
}

import type { WalletEngine } from '../engine/WalletEngine.js';
import type { AccountRef, Balance } from '../engine/types.js';

/** Reads balances for an account. Jetton balances arrive in M3. */
export class BalanceService {
  constructor(private readonly engine: WalletEngine) {}

  getTon(account: AccountRef): Promise<Balance> {
    return this.engine.getBalance(account);
  }
}

import type { AccountRef, HistoryItem, JettonBalance, Page } from '../engine/types.js';

export interface HistoryQuery {
  limit?: number;
  cursor?: string;
}

/**
 * Read-only indexed data that the engine doesn't provide (history, jetton balances,
 * later NFTs). Implemented by TonAPI; kept behind a port so the provider is swappable.
 */
export interface IndexerPort {
  getHistory(account: AccountRef, query?: HistoryQuery): Promise<Page<HistoryItem>>;
  getJettons(account: AccountRef): Promise<JettonBalance[]>;
}

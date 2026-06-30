import type { AccountRef, HistoryItem, Page } from '../engine/types.js';

export interface HistoryQuery {
  limit?: number;
  cursor?: string;
}

/**
 * Read-only indexed data that the engine doesn't provide (history, and later jetton
 * lists / NFTs). Implemented by TonAPI; kept behind a port so the provider is swappable.
 */
export interface IndexerPort {
  getHistory(account: AccountRef, query?: HistoryQuery): Promise<Page<HistoryItem>>;
}

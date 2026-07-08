import type { AccountRef, HistoryItem, JettonBalance, NftItem, Page } from '../engine/types.js';

export interface HistoryQuery {
  limit?: number;
  cursor?: string;
}

/** Display metadata for a jetton master (name/symbol are sanitized by the adapter). */
export interface JettonMeta {
  decimals: number;
  symbol?: string;
  name?: string;
}

/**
 * Read-only indexed data that the engine doesn't provide (history, jetton balances,
 * NFTs). Implemented by TonAPI; kept behind a port so the provider is swappable.
 */
export interface IndexerPort {
  getHistory(account: AccountRef, query?: HistoryQuery): Promise<Page<HistoryItem>>;
  getJettons(account: AccountRef): Promise<JettonBalance[]>;
  getNfts(account: AccountRef): Promise<NftItem[]>;
  /** Resolve a jetton master's display metadata (decimals/symbol), or undefined if unknown. */
  getJettonMeta(master: string): Promise<JettonMeta | undefined>;
}

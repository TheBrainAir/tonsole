import type { AccountRef, HistoryItem, Page } from '../engine/types.js';
import type { HistoryQuery, IndexerPort } from '../network/IndexerPort.js';

/** Paginated, parsed transaction history (served by the indexer, not the engine). */
export class HistoryService {
  constructor(private readonly indexer: IndexerPort) {}

  recent(account: AccountRef, query?: HistoryQuery): Promise<Page<HistoryItem>> {
    return this.indexer.getHistory(account, query);
  }
}

import type { AccountRef, NftItem } from '../engine/types.js';
import type { IndexerPort } from '../network/IndexerPort.js';

/** Lists the NFTs held by an account (served by the indexer). */
export class NftService {
  constructor(private readonly indexer: IndexerPort) {}

  list(account: AccountRef): Promise<NftItem[]> {
    return this.indexer.getNfts(account);
  }
}

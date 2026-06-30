import type { NetworkId } from '../engine/types.js';

export interface NetworkPreset {
  id: NetworkId;
  /** TonCenter v2 base (no trailing slash); the engine appends /api/v2/…. */
  toncenterUrl: string;
  /** TonAPI base (indexed history, jettons, NFTs). */
  tonapiUrl: string;
  explorerAddress: (address: string) => string;
  explorerTx: (hash: string) => string;
}

export const NETWORKS: Record<NetworkId, NetworkPreset> = {
  mainnet: {
    id: 'mainnet',
    toncenterUrl: 'https://toncenter.com',
    tonapiUrl: 'https://tonapi.io',
    explorerAddress: (a) => `https://tonviewer.com/${a}`,
    explorerTx: (h) => `https://tonviewer.com/transaction/${h}`,
  },
  testnet: {
    id: 'testnet',
    toncenterUrl: 'https://testnet.toncenter.com',
    tonapiUrl: 'https://testnet.tonapi.io',
    explorerAddress: (a) => `https://testnet.tonviewer.com/${a}`,
    explorerTx: (h) => `https://testnet.tonviewer.com/transaction/${h}`,
  },
};

import { AppError } from '../engine/errors.js';
import type { NetworkId } from '../engine/types.js';

export const NETWORK_IDS = ['mainnet', 'testnet'] as const;

export function isNetworkId(value: string): value is NetworkId {
  return (NETWORK_IDS as readonly string[]).includes(value);
}

/** Validate a user-supplied network name (CLI flag, TUI picker). */
export function parseNetworkId(value: string): NetworkId {
  if (!isNetworkId(value)) {
    throw new AppError('Unknown', `Unknown network "${value}" — use "mainnet" or "testnet".`);
  }
  return value;
}

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

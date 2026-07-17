import { describe, expect, it } from 'vitest';
import { AppError } from '../engine/errors.js';
import { NETWORKS, isNetworkId, parseNetworkId } from './networks.js';

describe('parseNetworkId', () => {
  it('accepts the two real networks', () => {
    expect(parseNetworkId('mainnet')).toBe('mainnet');
    expect(parseNetworkId('testnet')).toBe('testnet');
  });

  it('rejects anything else with a message naming the valid values', () => {
    expect(() => parseNetworkId('devnet')).toThrow(AppError);
    expect(() => parseNetworkId('devnet')).toThrow(/"mainnet" or "testnet"/);
    expect(isNetworkId('devnet')).toBe(false);
  });
});

describe('NETWORKS presets', () => {
  it('points each network at its own endpoints and explorer', () => {
    expect(NETWORKS.mainnet.tonapiUrl).toBe('https://tonapi.io');
    expect(NETWORKS.testnet.tonapiUrl).toBe('https://testnet.tonapi.io');
    // A testnet link must never resolve on the mainnet explorer.
    expect(NETWORKS.testnet.explorerAddress('X')).toContain('testnet.tonviewer.com');
    expect(NETWORKS.mainnet.explorerAddress('X')).not.toContain('testnet');
  });
});

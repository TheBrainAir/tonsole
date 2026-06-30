import { Address } from '@ton/core';
import { describe, expect, it } from 'vitest';
import { normalizeStoredEvent } from './tonconnect-normalize.js';

const RAW_DEST = '0:daba401e640e1168a7fa6e717fd9479604dd944fade03f6ce21a6bdcc69bc17d';
const RAW_FROM = '0:8214e70bb9c64ad5f26675154bcbdadb1cd690ad12e74cbcfa1ab62ed9a51d66';

function storedEvent(message: Record<string, unknown>): string {
  const params = JSON.stringify({
    messages: [message],
    valid_until: 1782805221438,
    from: RAW_FROM,
    network: '-3',
  });
  return JSON.stringify({ id: '0', method: 'sendTransaction', params: [params] });
}

describe('normalizeStoredEvent', () => {
  it('rewrites a raw message address to friendly, non-bounceable when a stateInit is present', () => {
    const out = normalizeStoredEvent(storedEvent({ address: RAW_DEST, amount: '250000000', stateInit: 'te6xxx' }), true);
    const message = JSON.parse(JSON.parse(out).params[0]).messages[0];

    expect(message.address).not.toBe(RAW_DEST);
    const friendly = Address.parseFriendly(message.address);
    expect(friendly.address.toRawString()).toBe(RAW_DEST); // same account
    expect(friendly.isBounceable).toBe(false); // stateInit => deploy => non-bounceable
    expect(friendly.isTestOnly).toBe(true); // testnet
  });

  it('uses a bounceable address when there is no stateInit', () => {
    const out = normalizeStoredEvent(storedEvent({ address: RAW_DEST, amount: '1000' }), false);
    const friendly = Address.parseFriendly(JSON.parse(JSON.parse(out).params[0]).messages[0].address);
    expect(friendly.isBounceable).toBe(true);
    expect(friendly.isTestOnly).toBe(false);
  });

  it('leaves the top-level from address untouched', () => {
    const out = normalizeStoredEvent(storedEvent({ address: RAW_DEST, amount: '1000' }), true);
    expect(JSON.parse(JSON.parse(out).params[0]).from).toBe(RAW_FROM);
  });

  it('passes through non-transaction and non-JSON values unchanged', () => {
    expect(normalizeStoredEvent('{"session":"abc"}', true)).toBe('{"session":"abc"}');
    expect(normalizeStoredEvent('not json', true)).toBe('not json');
  });
});

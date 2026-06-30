import { describe, expect, it } from 'vitest';
import { AppError } from '../engine/errors.js';
import { isValidAddress, parseAddress, sameAddress, toFriendly, toRaw } from './address.js';

// Same V5R1 account rendered two ways (captured from the M0 derivation cross-check):
const EQ = 'EQBfBlddiaxlpNgkKlBOvEcBai7TnoaJBq8ROWl8s3ZsiaUV'; // bounceable, mainnet
const UQ = 'UQBfBlddiaxlpNgkKlBOvEcBai7TnoaJBq8ROWl8s3ZsifjQ'; // non-bounceable, same account

describe('address', () => {
  it('treats EQ (bounceable) and UQ (non-bounceable) as the same account', () => {
    expect(sameAddress(EQ, UQ)).toBe(true);
    expect(toRaw(parseAddress(EQ))).toBe(toRaw(parseAddress(UQ)));
  });

  it('round-trips through the raw form', () => {
    const raw = toRaw(parseAddress(EQ));
    expect(raw.startsWith('0:')).toBe(true);
    expect(toRaw(parseAddress(raw))).toBe(raw);
  });

  it('renders non-bounceable UQ for wallet display, bounceable EQ on request', () => {
    expect(toFriendly(parseAddress(EQ), { network: 'mainnet' })).toBe(UQ);
    expect(toFriendly(parseAddress(UQ), { network: 'mainnet', bounceable: true })).toBe(EQ);
  });

  it('validates good addresses and rejects junk', () => {
    expect(isValidAddress(EQ)).toBe(true);
    expect(isValidAddress('not-an-address')).toBe(false);
    expect(() => parseAddress('nope')).toThrow(AppError);
    expect(sameAddress('nope', UQ)).toBe(false);
  });
});

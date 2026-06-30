import { describe, expect, it } from 'vitest';
import { AppError } from '../engine/errors.js';
import { formatAmount, formatTon, parseAmount, parseTon } from './amount.js';

describe('parseAmount', () => {
  it('parses TON amounts to nanotons', () => {
    expect(parseTon('1.5')).toBe(1_500_000_000n);
    expect(parseTon('1')).toBe(1_000_000_000n);
    expect(parseTon('0')).toBe(0n);
    expect(parseTon('0.000000001')).toBe(1n);
    expect(parseTon('.5')).toBe(500_000_000n);
    expect(parseTon('  2.25  ')).toBe(2_250_000_000n);
  });

  it('respects jetton decimals (USDT = 6)', () => {
    expect(parseAmount('1', 6)).toBe(1_000_000n);
    expect(parseAmount('0.000001', 6)).toBe(1n);
    expect(parseAmount('12.34', 6)).toBe(12_340_000n);
  });

  it('rejects too many fractional digits', () => {
    expect(() => parseTon('1.0000000001')).toThrow(AppError);
    expect(() => parseAmount('1.1234567', 6)).toThrow(/decimal places/);
  });

  it('rejects negatives and junk', () => {
    for (const bad of ['-1', 'abc', '', '.', '1.2.3', '1e9', '0x10', ' ']) {
      expect(() => parseTon(bad), bad).toThrow(AppError);
    }
  });
});

describe('formatAmount', () => {
  it('formats nanotons, trimming trailing zeros', () => {
    expect(formatTon(1_500_000_000n)).toBe('1.5');
    expect(formatTon(2_000_000_000n)).toBe('2');
    expect(formatTon(1n)).toBe('0.000000001');
    expect(formatTon(0n)).toBe('0');
  });

  it('is the inverse of parseAmount across decimals', () => {
    for (const [s, d] of [
      ['1.5', 9],
      ['0.000001', 6],
      ['123.456', 9],
      ['1000000', 0],
    ] as const) {
      expect(formatAmount(parseAmount(s, d), d)).toBe(s);
    }
  });

  it('can keep trailing zeros when asked', () => {
    expect(formatAmount(1_500_000_000n, 9, { trimTrailingZeros: false })).toBe('1.500000000');
  });
});

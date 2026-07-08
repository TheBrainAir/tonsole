import { AppError } from '../engine/errors.js';

/** TON has 9 decimals (1 TON = 1_000_000_000 nanotons). */
export const TON_DECIMALS = 9;

/**
 * Parse a human decimal string ("1.5") into integer smallest-units for the given
 * number of decimals (9 for TON, variable for jettons). Pure, exact, bigint-only —
 * never goes through floating point.
 *
 * Rejects: negatives, blanks, non-numeric, and more fractional digits than `decimals`.
 */
export function parseAmount(input: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    throw new AppError('InvalidAmount', `Invalid token decimals: ${decimals}.`);
  }
  const s = input.trim();
  if (s === '' || s === '.' || !/^\d*\.?\d*$/.test(s)) {
    throw new AppError('InvalidAmount', `Not a valid amount: "${input}"`);
  }
  const dot = s.indexOf('.');
  const intPart = dot === -1 ? s : s.slice(0, dot);
  const fracPart = dot === -1 ? '' : s.slice(dot + 1);
  if (fracPart.length > decimals) {
    throw new AppError(
      'InvalidAmount',
      `"${input}" has ${fracPart.length} decimal places but only ${decimals} are allowed.`,
    );
  }
  const base = 10n ** BigInt(decimals);
  const whole = intPart === '' ? 0n : BigInt(intPart);
  const frac = fracPart === '' ? 0n : BigInt(fracPart.padEnd(decimals, '0'));
  return whole * base + frac;
}

/**
 * Format integer smallest-units back into a human decimal string, trimming
 * trailing fractional zeros by default ("1.50" -> "1.5", "2.000000000" -> "2").
 */
export function formatAmount(
  value: bigint,
  decimals: number,
  opts?: { trimTrailingZeros?: boolean },
): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, '0');
  if (opts?.trimTrailingZeros !== false) {
    frac = frac.replace(/0+$/, '');
  }
  const body = frac.length > 0 ? `${whole}.${frac}` : `${whole}`;
  return negative ? `-${body}` : body;
}

/** Convenience wrappers for native-coin amounts (9 decimals). */
export const parseTon = (input: string): bigint => parseAmount(input, TON_DECIMALS);
export const formatTon = (nano: bigint): string => formatAmount(nano, TON_DECIMALS);

/**
 * Display ticker of the native coin. The Open Network's coin was renamed
 * Toncoin (TON) -> Gram (GRAM) on 2026-06-15; the blockchain itself is still "TON".
 */
export const COIN_SYMBOL = 'GRAM';

/** Format a native-coin amount with its ticker, e.g. "1.5 GRAM". */
export const formatCoin = (nano: bigint): string => `${formatTon(nano)} ${COIN_SYMBOL}`;

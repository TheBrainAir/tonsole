import { Address } from '@ton/core';
import { AppError } from '../engine/errors.js';
import type { NetworkId } from '../engine/types.js';

/**
 * Parse any TON address form (raw "0:…" or user-friendly EQ/UQ/kQ/0Q) into a
 * canonical @ton/core Address. Throws a normalized AppError on malformed input.
 */
export function parseAddress(input: string): Address {
  try {
    return Address.parse(input.trim());
  } catch (cause) {
    throw new AppError('InvalidAddress', `Invalid TON address: "${input}"`, { cause });
  }
}

export function isValidAddress(input: string): boolean {
  try {
    Address.parse(input.trim());
    return true;
  } catch {
    return false;
  }
}

/** Canonical raw form, e.g. "0:abcd…". Use this for storage and comparison. */
export function toRaw(address: Address): string {
  return address.toRawString();
}

/**
 * Render an address for display. Defaults to the **non-bounceable** (UQ/0Q) form,
 * which is the correct display form for wallets; the testnet flag follows `network`.
 */
export function toFriendly(
  address: Address,
  opts: { network: NetworkId; bounceable?: boolean },
): string {
  return address.toString({
    urlSafe: true,
    testOnly: opts.network === 'testnet',
    bounceable: opts.bounceable ?? false,
  });
}

/** True when two address strings (any form) refer to the same account. */
export function sameAddress(a: string, b: string): boolean {
  try {
    return Address.parse(a.trim()).equals(Address.parse(b.trim()));
  } catch {
    return false;
  }
}

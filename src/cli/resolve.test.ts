import { describe, expect, it } from 'vitest';
import type { App } from '../composition.js';
import { ConfigSchema } from '../config/schema.js';
import { AppError } from '../engine/errors.js';
import type { StoredAccount } from '../services/AccountService.js';
import { resolveAccountArg } from './resolve.js';

const ADDRESS = 'UQBfBlddiaxlpNgkKlBOvEcBai7TnoaJBq8ROWl8s3ZsifjQ';

/** Only `config` and `accounts.resolve` are on the path under test. */
function appWith(resolve: () => StoredAccount): App {
  return {
    config: ConfigSchema.parse({ network: 'mainnet' }),
    accounts: { resolve },
  } as unknown as App;
}

describe('resolveAccountArg', () => {
  it('falls back to a watch-only ref when no such wallet is stored', () => {
    const app = appWith(() => {
      throw new AppError('KeystoreNotFound', 'No wallets yet.');
    });
    const ref = resolveAccountArg(app, ADDRESS);
    expect(ref.address).toBe(ADDRESS);
    expect(ref.network).toBe('mainnet');
    expect(ref.publicKey).toBe('');
  });

  it('propagates a network mismatch instead of re-tagging it for the active network', () => {
    // The address is valid, so the watch-only fallback would happily accept it — and
    // would then read mainnet for a wallet the user holds on testnet. It must throw.
    const app = appWith(() => {
      throw new AppError('NetworkMismatch', 'Wallet "w" is a testnet wallet…');
    });
    expect(() => resolveAccountArg(app, ADDRESS)).toThrow(AppError);
    try {
      resolveAccountArg(app, ADDRESS);
    } catch (error) {
      expect(AppError.is(error, 'NetworkMismatch')).toBe(true);
    }
  });

  it('returns the stored wallet when one resolves', () => {
    const stored = {
      id: 'w1',
      isDefault: true,
      account: { address: ADDRESS, network: 'mainnet' },
    } as StoredAccount;
    expect(resolveAccountArg(appWith(() => stored), 'w1')).toBe(stored.account);
  });

  it('does not invent a watch-only ref for junk input', () => {
    const app = appWith(() => {
      throw new AppError('KeystoreNotFound', 'No wallet matching "junk".');
    });
    expect(() => resolveAccountArg(app, 'junk')).toThrow(/No wallet matching/);
  });
});

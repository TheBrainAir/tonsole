import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../engine/errors.js';
import { promptPassphrase } from './passphrase.js';

describe('promptPassphrase (TONSOLE_PASSPHRASE env path)', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.TONSOLE_PASSPHRASE;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.TONSOLE_PASSPHRASE;
    else process.env.TONSOLE_PASSPHRASE = saved;
  });

  it('rejects an empty env passphrase when a minimum length is required', async () => {
    process.env.TONSOLE_PASSPHRASE = '';
    await expect(promptPassphrase('x', { minLength: 8 })).rejects.toSatisfy((e) =>
      AppError.is(e, 'WrongPassphrase'),
    );
  });

  it('rejects a too-short env passphrase', async () => {
    process.env.TONSOLE_PASSPHRASE = 'short';
    await expect(promptPassphrase('x', { minLength: 8 })).rejects.toSatisfy((e) =>
      AppError.is(e, 'WrongPassphrase'),
    );
  });

  it('accepts an env passphrase that meets the minimum length', async () => {
    process.env.TONSOLE_PASSPHRASE = 'longenough123';
    const secret = await promptPassphrase('x', { minLength: 8 });
    expect(secret.use((v) => v)).toBe('longenough123');
    secret.destroy();
  });
});

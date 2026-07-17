import { describe, expect, it } from 'vitest';
import { AppError } from '../engine/errors.js';
import { assertSafeKdfParams, parseKeystore } from './keystore-schema.js';

function validKeystore(): Record<string, unknown> {
  return {
    version: 3,
    id: 'abc',
    address: 'UQtest',
    ton: {
      walletVersion: 'v5r1',
      workchain: 0,
      network: 'testnet',
      address: 'UQtest',
      publicKey: 'deadbeef',
    },
    crypto: {
      cipher: 'aes-256-gcm',
      cipherparams: { iv: 'a'.repeat(24) },
      ciphertext: 'b'.repeat(64),
      kdf: 'argon2id',
      kdfparams: { salt: 'c'.repeat(32), m: 65536, t: 3, p: 4, dklen: 32 },
    },
  };
}

type Mut = Record<string, unknown>;
const crypto = (k: Mut): Mut => k.crypto as Mut;
const kdf = (k: Mut): Mut => crypto(k).kdfparams as Mut;

describe('parseKeystore', () => {
  it('accepts a well-formed keystore', () => {
    expect(() => parseKeystore(validKeystore())).not.toThrow();
  });

  it('rejects a DoS-crafted memory cost (m too large)', () => {
    const k = validKeystore();
    kdf(k).m = 4_294_967_296; // 4 GiB
    expect(() => parseKeystore(k)).toThrow();
  });

  it('rejects negative / non-integer kdf params', () => {
    const k = validKeystore();
    kdf(k).t = -1;
    expect(() => parseKeystore(k)).toThrow();
  });

  it('rejects a wrong derived-key length', () => {
    const k = validKeystore();
    kdf(k).dklen = 16;
    expect(() => parseKeystore(k)).toThrow();
  });

  it('rejects a non-hex ciphertext', () => {
    const k = validKeystore();
    crypto(k).ciphertext = 'not-hex!!';
    expect(() => parseKeystore(k)).toThrow();
  });

  it('rejects an unsupported version / cipher', () => {
    const k = validKeystore();
    k.version = 2;
    expect(() => parseKeystore(k)).toThrow();
  });

  it('accepts every supported wallet contract version', () => {
    for (const walletVersion of ['v5r1', 'v4r2']) {
      const k = validKeystore();
      (k.ton as Mut).walletVersion = walletVersion;
      expect(() => parseKeystore(k)).not.toThrow();
    }
  });

  it('rejects an unknown wallet contract version', () => {
    const k = validKeystore();
    (k.ton as Mut).walletVersion = 'v3r2';
    expect(() => parseKeystore(k)).toThrow();
  });
});

describe('assertSafeKdfParams', () => {
  it('passes for OWASP defaults', () => {
    expect(() => assertSafeKdfParams({ salt: 'aa', m: 65536, t: 3, p: 4, dklen: 32 })).not.toThrow();
  });

  it('throws a WrongPassphrase AppError for unsafe params', () => {
    try {
      assertSafeKdfParams({ salt: 'aa', m: 9_999_999_999, t: 3, p: 4, dklen: 32 });
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(AppError.is(e, 'WrongPassphrase')).toBe(true);
    }
  });
});

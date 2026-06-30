import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { AppError } from '../engine/errors.js';
import { type KeystoreTonMeta, decryptKeystore, encryptKeystore } from './ArgonKeystore.js';

// Tiny KDF cost keeps the crypto round-trip fast in tests; production uses DEFAULT_KDF.
const FAST_KDF = { m: 8_192, t: 1, p: 1, dklen: 32 };
const META: KeystoreTonMeta = {
  walletVersion: 'v5r1',
  workchain: 0,
  network: 'testnet',
  address: 'UQTestAddressForKeystore',
  publicKey: 'aabbccdd',
};
// Any string round-trips; the keystore just encrypts the mnemonic text.
const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident ' +
  'account accuse achieve acid acoustic acquire across act action actor actress actual';

describe('ArgonKeystore', () => {
  it('encrypts then decrypts back to the same mnemonic', async () => {
    const ks = await encryptKeystore(MNEMONIC, 'correct horse battery staple', META, FAST_KDF);
    expect(ks.version).toBe(3);
    expect(ks.crypto.kdf).toBe('argon2id');
    expect(ks.crypto.cipher).toBe('aes-256-gcm');
    expect(ks.ton).toEqual(META);
    expect(ks.crypto.ciphertext).not.toContain('abandon'); // not stored in clear

    const out = await decryptKeystore(ks, 'correct horse battery staple');
    expect(out).toBe(MNEMONIC);
  }, 20_000);

  it('rejects a wrong passphrase with a WrongPassphrase AppError', async () => {
    const ks = await encryptKeystore(MNEMONIC, 'right-passphrase', META, FAST_KDF);
    await expect(decryptKeystore(ks, 'wrong-passphrase')).rejects.toMatchObject({
      code: 'WrongPassphrase',
    });
  }, 20_000);

  it('detects tampered ciphertext (GCM auth)', async () => {
    const ks = await encryptKeystore(MNEMONIC, 'pw', META, FAST_KDF);
    const bytes = Buffer.from(ks.crypto.ciphertext, 'hex');
    bytes[0] = bytes[0]! ^ 0xff;
    ks.crypto.ciphertext = bytes.toString('hex');
    await expect(decryptKeystore(ks, 'pw')).rejects.toBeInstanceOf(AppError);
  }, 20_000);

  it('uses a random salt and iv per keystore', async () => {
    const a = await encryptKeystore(MNEMONIC, 'pw', META, FAST_KDF);
    const b = await encryptKeystore(MNEMONIC, 'pw', META, FAST_KDF);
    expect(a.crypto.kdfparams.salt).not.toBe(b.crypto.kdfparams.salt);
    expect(a.crypto.cipherparams.iv).not.toBe(b.crypto.cipherparams.iv);
    expect(a.crypto.ciphertext).not.toBe(b.crypto.ciphertext);
  }, 20_000);
});

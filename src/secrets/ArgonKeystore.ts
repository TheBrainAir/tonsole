import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { AppError } from '../engine/errors.js';
import type { NetworkId, WalletVersion } from '../engine/types.js';
import { assertSafeKdfParams } from './keystore-schema.js';

export interface KdfParams {
  salt: string;
  /** Argon2 memory cost (KiB). */
  m: number;
  /** Argon2 time cost (iterations). */
  t: number;
  /** Argon2 parallelism (lanes). */
  p: number;
  /** Derived key length (bytes). */
  dklen: number;
}

export interface KeystoreTonMeta {
  walletVersion: WalletVersion;
  workchain: number;
  network: NetworkId;
  /** User-friendly address, for display and identifying the keystore. */
  address: string;
  /** Public key (hex, no 0x) — lets us reconstruct the account without decrypting. */
  publicKey: string;
}

/**
 * An encrypted wallet keystore. Follows the Ethereum Web3 Secret Storage v3 shape
 * (so the format is familiar and inspectable) extended with TON metadata. Only the
 * 24-word mnemonic is encrypted; key derivation itself is done by the engine.
 */
export interface Keystore {
  version: 3;
  id: string;
  address: string;
  /** Optional user-assigned label, for display. */
  label?: string;
  ton: KeystoreTonMeta;
  crypto: {
    cipher: 'aes-256-gcm';
    cipherparams: { iv: string };
    /** hex( ciphertext || 16-byte GCM auth tag ) */
    ciphertext: string;
    kdf: 'argon2id';
    kdfparams: KdfParams;
  };
}

/** OWASP-aligned defaults: 64 MiB, 3 passes, 4 lanes, 32-byte key. */
export const DEFAULT_KDF: Omit<KdfParams, 'salt'> = { m: 65_536, t: 3, p: 4, dklen: 32 };

async function deriveKey(
  passphrase: string,
  salt: Buffer,
  params: Omit<KdfParams, 'salt'>,
): Promise<Buffer> {
  return argon2.hash(passphrase, {
    type: argon2.argon2id,
    salt,
    memoryCost: params.m,
    timeCost: params.t,
    parallelism: params.p,
    hashLength: params.dklen,
    raw: true,
  });
}

export async function encryptKeystore(
  mnemonic: string,
  passphrase: string,
  meta: KeystoreTonMeta,
  kdf: Omit<KdfParams, 'salt'> = DEFAULT_KDF,
): Promise<Keystore> {
  const salt = randomBytes(16);
  const iv = randomBytes(12); // 96-bit nonce, the GCM standard
  const key = await deriveKey(passphrase, salt, kdf);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(mnemonic, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      version: 3,
      id: randomUUID(),
      address: meta.address,
      ton: meta,
      crypto: {
        cipher: 'aes-256-gcm',
        cipherparams: { iv: iv.toString('hex') },
        ciphertext: Buffer.concat([enc, tag]).toString('hex'),
        kdf: 'argon2id',
        kdfparams: { salt: salt.toString('hex'), ...kdf },
      },
    };
  } finally {
    key.fill(0);
  }
}

export async function decryptKeystore(keystore: Keystore, passphrase: string): Promise<string> {
  const { crypto: c } = keystore;
  // Never feed attacker-controllable KDF params to the native argon2 binding unbounded.
  assertSafeKdfParams(c.kdfparams);
  const salt = Buffer.from(c.kdfparams.salt, 'hex');
  const key = await deriveKey(passphrase, salt, c.kdfparams);
  try {
    const iv = Buffer.from(c.cipherparams.iv, 'hex');
    const data = Buffer.from(c.ciphertext, 'hex');
    if (data.length < 16) {
      throw new AppError('WrongPassphrase', 'Corrupted keystore: ciphertext too short.');
    }
    const tag = data.subarray(data.length - 16);
    const enc = data.subarray(0, data.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch (cause) {
    if (AppError.is(cause)) throw cause;
    // A wrong passphrase derives a wrong key -> GCM tag verification fails in final().
    throw new AppError('WrongPassphrase', 'Incorrect passphrase or corrupted keystore.', { cause });
  } finally {
    key.fill(0);
  }
}

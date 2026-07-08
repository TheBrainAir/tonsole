import { z } from 'zod';
import { AppError } from '../engine/errors.js';
import type { Keystore } from './ArgonKeystore.js';

/**
 * Schema for the on-disk keystore. Validating on load does two things:
 *  1. Rejects structurally malformed / tampered files with a clear error.
 *  2. Bounds the Argon2 KDF parameters BEFORE they reach the native binding — an
 *     attacker-planted file with `m = 4 GiB` (or a huge `t`) would otherwise hang or
 *     OOM the process the moment the user unlocks that account (a local DoS).
 *
 * Legit keystores produced by `encryptKeystore` (m=65536, t=3, p=4, dklen=32) always
 * satisfy these bounds, so validation never locks a user out of their own wallet.
 */
const hex = z.string().regex(/^[0-9a-fA-F]+$/, 'expected hex');

/** OWASP floors up to a 1 GiB / 10-pass / 16-lane ceiling — generous but not a DoS. */
export const KdfParamsSchema = z.object({
  salt: hex,
  m: z.number().int().min(8).max(1_048_576),
  t: z.number().int().min(1).max(10),
  p: z.number().int().min(1).max(16),
  dklen: z.literal(32),
});

const TonMetaSchema = z.object({
  walletVersion: z.enum(['v5r1', 'v4r2']),
  workchain: z.number().int(),
  network: z.enum(['mainnet', 'testnet']),
  address: z.string().min(1),
  publicKey: hex,
});

export const KeystoreSchema = z.object({
  version: z.literal(3),
  id: z.string().min(1),
  address: z.string().min(1),
  label: z.string().optional(),
  ton: TonMetaSchema,
  crypto: z.object({
    cipher: z.literal('aes-256-gcm'),
    cipherparams: z.object({ iv: hex }),
    ciphertext: hex,
    kdf: z.literal('argon2id'),
    kdfparams: KdfParamsSchema,
  }),
});

/** Parse+validate untrusted keystore JSON into a Keystore, or throw on any violation. */
export function parseKeystore(raw: unknown): Keystore {
  return KeystoreSchema.parse(raw) as Keystore;
}

/** Guard the KDF params right before feeding argon2, independent of how we got here. */
export function assertSafeKdfParams(params: unknown): void {
  const result = KdfParamsSchema.safeParse(params);
  if (!result.success) {
    throw new AppError('WrongPassphrase', 'Keystore has invalid or unsafe key-derivation parameters.');
  }
}

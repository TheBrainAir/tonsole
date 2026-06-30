import { mnemonicNew, mnemonicValidate } from '@ton/crypto';

/** TON wallets use a 24-word recovery phrase. */
export const MNEMONIC_WORDS = 24;

/** Generate a fresh, valid 24-word TON mnemonic (TON-specific scheme, not BIP39 seed). */
export async function generateMnemonic(): Promise<string[]> {
  return mnemonicNew(MNEMONIC_WORDS);
}

/** Validate a 24-word TON mnemonic. Returns false (never throws) for any bad input. */
export async function validateMnemonic(words: string[]): Promise<boolean> {
  if (words.length !== MNEMONIC_WORDS) return false;
  try {
    return await mnemonicValidate(words);
  } catch {
    return false;
  }
}

/** Normalize user-entered mnemonic text/words: NFKD, trim, lowercase, collapse whitespace. */
export function normalizeMnemonic(input: string | string[]): string[] {
  const text = Array.isArray(input) ? input.join(' ') : input;
  return text.normalize('NFKD').trim().toLowerCase().split(/\s+/).filter(Boolean);
}

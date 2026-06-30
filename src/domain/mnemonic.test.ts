import { describe, expect, it } from 'vitest';
import { MNEMONIC_WORDS, generateMnemonic, normalizeMnemonic, validateMnemonic } from './mnemonic.js';

describe('mnemonic', () => {
  it('generates a valid 24-word lowercase mnemonic', async () => {
    const m = await generateMnemonic();
    expect(m).toHaveLength(MNEMONIC_WORDS);
    expect(m.every((w) => w.length > 0 && w === w.toLowerCase())).toBe(true);
    expect(await validateMnemonic(m)).toBe(true);
  }, 20_000);

  it('rejects a wrong-length phrase without throwing', async () => {
    expect(await validateMnemonic(['too', 'short'])).toBe(false);
  });

  it('normalizes whitespace, case and accepts arrays', () => {
    expect(normalizeMnemonic('  Abandon   Ability\tABLE\n')).toEqual(['abandon', 'ability', 'able']);
    expect(normalizeMnemonic(['One', 'Two'])).toEqual(['one', 'two']);
  });
});

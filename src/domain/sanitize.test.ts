import { describe, expect, it } from 'vitest';
import { sanitizeOptional, sanitizeText } from './sanitize.js';

describe('sanitizeText', () => {
  it('strips ANSI CSI escape sequences (color/cursor)', () => {
    // "\x1b[31mHACK\x1b[0m" — red text; the ESC bytes must not survive.
    const out = sanitizeText('\x1b[31mHACK\x1b[0m');
    expect(out).not.toContain('\x1b');
    expect(out).toBe('[31mHACK[0m'); // ESC bytes gone; printable remainder kept
    expect(out).toContain('HACK');
  });

  it('strips an OSC 52 clipboard-write sequence', () => {
    const evil = '\x1b]52;c;ZXZpbA==\x07pay me';
    const out = sanitizeText(evil);
    expect(out).not.toContain('\x1b');
    expect(out).not.toContain('\x07');
    expect(out).toContain('pay me');
  });

  it('removes C0 and C1 control characters', () => {
    expect(sanitizeText('a\x00b\x07c\x1bd')).toBe('abcd');
    expect(sanitizeText('x\x9by')).toBe('xy'); // C1 CSI introducer
  });

  it('removes Unicode bidi overrides used to visually reorder text', () => {
    const out = sanitizeText('good‮gnol‬');
    expect(out).not.toContain('‮');
    expect(out).not.toContain('‬');
  });

  it('removes invisible / zero-width and directional format characters', () => {
    // ZWSP, ZWNJ, ZWJ, LRM, RLM, ALM, word-joiner, BOM — all should be stripped.
    const evil = 'a​b‌‍‎‏؜⁠﻿c';
    expect(sanitizeText(evil)).toBe('abc');
  });

  it('collapses newlines/tabs to a single space so a memo stays on one line', () => {
    expect(sanitizeText('line1\n\n\tline2')).toBe('line1 line2');
  });

  it('caps length and preserves ordinary text', () => {
    expect(sanitizeText('USDT')).toBe('USDT');
    const long = 'a'.repeat(500);
    expect(sanitizeText(long, { maxLen: 32 }).length).toBe(32);
    expect(sanitizeText(long, { maxLen: 32 }).endsWith('…')).toBe(true);
  });

  it('handles empty / undefined input', () => {
    expect(sanitizeText('')).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });
});

describe('sanitizeOptional', () => {
  it('returns undefined when the value is missing or becomes empty', () => {
    expect(sanitizeOptional(undefined)).toBeUndefined();
    expect(sanitizeOptional('\x1b\x00')).toBeUndefined();
  });

  it('returns the cleaned string otherwise', () => {
    expect(sanitizeOptional('  hi\x07  ')).toBe('hi');
  });
});

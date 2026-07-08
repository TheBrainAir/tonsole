/**
 * Defensive sanitizer for UNTRUSTED strings that originate on-chain or from a dApp
 * (jetton/NFT names & symbols, transfer comments/memos, dApp name/url, emulated
 * counterparty names) before they are written to the terminal.
 *
 * Why this exists: Ink `<Text>` and chalk template strings pass their content to
 * the terminal verbatim. A raw ANSI/OSC escape sequence embedded in an on-chain
 * comment can reposition the cursor to rewrite the "you send / total leaving" lines
 * a user relies on to approve a transfer, spoof an OSC 8 hyperlink, or overwrite the
 * clipboard via OSC 52 — just by the victim opening History or an approval prompt.
 *
 * Rule: sanitize at every DISPLAY boundary. Raw values are still compared/stored in
 * canonical form elsewhere; this only touches what reaches the screen/clipboard.
 */

const DEFAULT_MAX_LEN = 256;

/**
 * Strip control characters and terminal escape/control sequences from a string,
 * leaving printable text (plus a normal space). Also removes Unicode bidirectional
 * controls, which can visually reorder an address/amount without changing bytes.
 *
 * - C0 controls (U+0000–U+001F) and DEL (U+007F) are removed, except that common
 *   whitespace (tab, newline, carriage return) is collapsed to a single space so a
 *   multi-line memo stays on one visual line rather than injecting blank rows.
 * - C1 controls (U+0080–U+009F) are removed (they can act as escape introducers).
 * - Unicode bidirectional and invisible format controls are removed — the bidi
 *   overrides/isolates (U+202A–U+202E, U+2066–U+2069) plus the marks that can still
 *   reorder or hide characters: ALM (U+061C), LRM/RLM (U+200E/200F), the zero-width
 *   space/joiners (U+200B–U+200D), the word joiner (U+2060), and the BOM (U+FEFF).
 * - The result is trimmed and capped at `maxLen` (with an ellipsis) to bound both
 *   layout damage and memory.
 */
function isFormatControl(code: number): boolean {
  return (
    code === 0x061c || // Arabic letter mark
    (code >= 0x200b && code <= 0x200f) || // ZWSP, ZWNJ, ZWJ, LRM, RLM
    (code >= 0x202a && code <= 0x202e) || // bidi embeddings/overrides
    code === 0x2060 || // word joiner
    (code >= 0x2066 && code <= 0x2069) || // bidi isolates
    code === 0xfeff // zero-width no-break space / BOM
  );
}

export function sanitizeText(input: string | undefined, opts?: { maxLen?: number }): string {
  if (input === undefined || input === '') return '';
  const maxLen = opts?.maxLen ?? DEFAULT_MAX_LEN;

  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    // Collapse tab/newline/carriage-return to a single space.
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      out += ' ';
      continue;
    }
    // Drop C0 controls (incl. ESC 0x1b) and DEL.
    if (code <= 0x1f || code === 0x7f) continue;
    // Drop C1 controls.
    if (code >= 0x80 && code <= 0x9f) continue;
    // Drop bidi/invisible format controls.
    if (isFormatControl(code)) continue;
    out += ch;
  }

  // Collapse runs of whitespace produced above, then trim.
  out = out.replace(/ {2,}/g, ' ').trim();

  if (out.length > maxLen) out = `${out.slice(0, maxLen - 1)}…`;
  return out;
}

/**
 * Sanitize an optional untrusted string, returning `undefined` when it is missing or
 * becomes empty after stripping — lets callers keep their `value ?? fallback` idiom.
 */
export function sanitizeOptional(input: string | undefined, opts?: { maxLen?: number }): string | undefined {
  if (input === undefined) return undefined;
  const cleaned = sanitizeText(input, opts);
  return cleaned === '' ? undefined : cleaned;
}

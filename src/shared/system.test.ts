import { describe, expect, it } from 'vitest';
import { openUrl } from './system.js';

describe('openUrl scheme allow-list', () => {
  it('refuses a file:// URL from untrusted metadata', () => {
    expect(openUrl('file:///etc/passwd')).toBe(false);
  });

  it('refuses custom / dangerous schemes', () => {
    expect(openUrl('javascript:alert(1)')).toBe(false);
    expect(openUrl('data:text/html,<script>1</script>')).toBe(false);
    expect(openUrl('ftp://example.com/x')).toBe(false);
  });

  it('refuses a non-URL string', () => {
    expect(openUrl('not a url')).toBe(false);
    expect(openUrl('')).toBe(false);
  });

  // Note: http/https are intentionally not exercised here — they would spawn a real
  // OS opener process. The rejection paths above return before any spawn.
});

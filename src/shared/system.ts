import { spawn } from 'node:child_process';
import clipboard from 'clipboardy';

/** Copy text to the system clipboard. */
export async function copyToClipboard(text: string): Promise<void> {
  await clipboard.write(text);
}

/**
 * Open a URL in the OS default browser (fire-and-forget, cross-platform).
 *
 * Some URLs come from untrusted NFT/dApp metadata, so this is defensive:
 *  - Only http/https is allowed (a `file://` or custom scheme could trigger an
 *    unintended local handler).
 *  - On Windows the URL is opened via `rundll32 url.dll,FileProtocolHandler`, NOT
 *    `cmd /c start`. `cmd.exe` re-parses its command line, so shell metacharacters
 *    (& | ^ ...) inside an accepted http(s) URL would execute arbitrary commands;
 *    `rundll32` receives the URL as a single argument with no shell involved.
 *  - As belt-and-braces, a URL containing raw control characters or whitespace
 *    (which a well-formed URL percent-encodes) is refused outright.
 *
 * `spawn` is used WITHOUT a shell, so on macOS/Linux the URL is passed as one argv
 * to `open`/`xdg-open` and is never interpreted by a shell. Returns false when the
 * URL is rejected.
 */
// eslint-disable-next-line no-control-regex
const UNSAFE_URL_CHARS = /[\x00-\x20\x7f]/;

export function openUrl(url: string): boolean {
  let scheme: string;
  try {
    scheme = new URL(url).protocol;
  } catch {
    return false;
  }
  if (scheme !== 'http:' && scheme !== 'https:') return false;
  if (UNSAFE_URL_CHARS.test(url)) return false;

  if (process.platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
  } else if (process.platform === 'win32') {
    spawn('rundll32', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore', detached: true }).unref();
  } else {
    spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
  }
  return true;
}

import { Buffer } from 'node:buffer';
import terminalImage from 'terminal-image';

/**
 * Render a remote image (NFT preview) to a terminal string: inline image on
 * iTerm2/Kitty, ANSI half-blocks elsewhere. Returns null on any failure
 * (network, unsupported format, timeout) so callers can fall back gracefully.
 */
export async function renderImagePreview(
  url: string,
  opts: { width?: number; height?: number } = {},
): Promise<string | null> {
  try {
    const fetchUrl = url.startsWith('ipfs://')
      ? `https://ipfs.io/ipfs/${url.slice('ipfs://'.length)}`
      : url;
    const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return await terminalImage.buffer(buffer, {
      width: opts.width ?? 24,
      height: opts.height ?? 12,
      preserveAspectRatio: true,
    });
  } catch {
    return null;
  }
}

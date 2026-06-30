import { Buffer } from 'node:buffer';
import { Chalk } from 'chalk';
import { Jimp, intToRGBA } from 'jimp';

// Force 24-bit color so the preview always renders, regardless of how chalk
// auto-detects the surrounding (Ink-managed) stream.
const paint = new Chalk({ level: 3 });

type Rgb = { r: number; g: number; b: number };

/**
 * Render a remote image (an NFT preview) as a block of ANSI half-block cells —
 * each `▀` is one terminal cell carrying two vertical pixels (fg = upper pixel,
 * bg = lower pixel). Unlike the iTerm2/Kitty inline-image protocols, these are
 * real character cells, so Ink lays them out inside a box and clears them on
 * navigation. Returns a `width × height` string, or null on any failure
 * (network, unsupported format such as WebP/SVG, timeout).
 */
export async function renderImagePreview(
  url: string,
  opts: { width?: number; height?: number } = {},
): Promise<string | null> {
  const cols = opts.width ?? 20;
  const pixelRows = (opts.height ?? 10) * 2;
  try {
    const fetchUrl = url.startsWith('ipfs://')
      ? `https://ipfs.io/ipfs/${url.slice('ipfs://'.length)}`
      : url;
    const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const image = await Jimp.fromBuffer(Buffer.from(await res.arrayBuffer()));
    image.resize({ w: cols, h: pixelRows });

    const lines: string[] = [];
    for (let y = 0; y < pixelRows; y += 2) {
      let line = '';
      for (let x = 0; x < cols; x++) {
        const top = overBlack(intToRGBA(image.getPixelColor(x, y)));
        const bottom = overBlack(intToRGBA(image.getPixelColor(x, Math.min(y + 1, pixelRows - 1))));
        line += paint.bgRgb(bottom.r, bottom.g, bottom.b).rgb(top.r, top.g, top.b)('▀');
      }
      lines.push(line);
    }
    return lines.join('\n');
  } catch {
    return null;
  }
}

/** Flatten a possibly-transparent pixel over black (matches dark terminals). */
function overBlack(px: { r: number; g: number; b: number; a: number }): Rgb {
  const a = px.a / 255;
  return { r: Math.round(px.r * a), g: Math.round(px.g * a), b: Math.round(px.b * a) };
}

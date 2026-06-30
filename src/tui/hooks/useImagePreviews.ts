import { useEffect, useReducer } from 'react';
import { renderImagePreview } from '../../shared/image.js';

// Module-level cache so thumbnails render once and survive screen remounts /
// re-selection. Value `string` = rendered blocks, `null` = failed/unsupported.
const cache = new Map<string, string | null>();
const inFlight = new Set<string>();
const keyOf = (url: string, w: number, h: number) => `${w}x${h}|${url}`;

/**
 * Render block thumbnails for a set of image URLs, cached by url+size. Returns a
 * getter `(url) => blocks | null`; the component re-renders as images finish.
 */
export function useImagePreviews(
  urls: (string | undefined)[],
  width: number,
  height: number,
): (url?: string) => string | null {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const wanted = urls.filter((u): u is string => typeof u === 'string' && u.length > 0);

  useEffect(() => {
    const todo = wanted.filter((u) => {
      const k = keyOf(u, width, height);
      return !cache.has(k) && !inFlight.has(k);
    });
    if (todo.length === 0) return;
    let active = true;
    todo.forEach((u) => inFlight.add(keyOf(u, width, height)));
    void Promise.all(
      todo.map(async (u) => {
        const k = keyOf(u, width, height);
        cache.set(k, await renderImagePreview(u, { width, height }));
        inFlight.delete(k);
      }),
    ).then(() => {
      if (active) bump();
    });
    return () => {
      active = false;
    };
  }, [wanted.join('|'), width, height]);

  return (url?: string) => (url ? (cache.get(keyOf(url, width, height)) ?? null) : null);
}

import { useEffect, useReducer } from 'react';
import { renderImagePreview } from '../../shared/image.js';

// Module-level cache so thumbnails render once and survive screen remounts /
// re-selection. Value `string` = rendered blocks, `null` = failed/unsupported.
const cache = new Map<string, string | null>();
const inFlight = new Set<string>();
// Every mounted hook instance, notified whenever ANY image finishes: an
// instance that mounts while a render is already in flight (screen re-entered)
// must still re-render on completion, and thumbnails appear progressively
// instead of after the whole batch settles.
const subscribers = new Set<() => void>();
const notify = () => {
  for (const bump of [...subscribers]) bump();
};
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
    subscribers.add(bump);
    return () => {
      subscribers.delete(bump);
    };
  }, []);

  useEffect(() => {
    const todo = wanted.filter((u) => {
      const k = keyOf(u, width, height);
      return !cache.has(k) && !inFlight.has(k);
    });
    for (const u of todo) {
      const k = keyOf(u, width, height);
      inFlight.add(k);
      renderImagePreview(u, { width, height })
        .then((blocks) => cache.set(k, blocks))
        .catch(() => cache.set(k, null))
        .finally(() => {
          inFlight.delete(k);
          notify();
        });
    }
  }, [wanted.join('|'), width, height]);

  return (url?: string) => (url ? (cache.get(keyOf(url, width, height)) ?? null) : null);
}

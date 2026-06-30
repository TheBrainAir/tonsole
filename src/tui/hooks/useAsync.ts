import { useEffect, useState } from 'react';

export interface AsyncState<T> {
  loading: boolean;
  data?: T;
  error?: Error;
}

/** Run an async loader on mount (and when deps change); exposes reload(). */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });
    loader()
      .then((data) => {
        if (!cancelled) setState({ loading: false, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ loading: false, error: error instanceof Error ? error : new Error(String(error)) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [...deps, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

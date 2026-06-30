import { AppError } from '../engine/errors.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface HttpOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Fetch JSON with a timeout, one-shot retries, and 429/backoff handling. Network
 * and HTTP failures are normalized to AppError so callers/UI render them uniformly.
 */
export async function getJson<T>(url: string, options: HttpOptions = {}): Promise<T> {
  const { headers, timeoutMs = 10_000, retries = 2 } = options;
  const host = safeHost(url);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (res.status === 429) {
        lastError = new AppError('RateLimited', `Rate limited by ${host}. Set an API key for higher limits.`);
      } else if (!res.ok) {
        throw new AppError('NetworkUnavailable', `HTTP ${res.status} from ${host}.`);
      } else {
        return (await res.json()) as T;
      }
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(250 * (attempt + 1));
  }

  if (AppError.is(lastError)) throw lastError;
  throw new AppError('NetworkUnavailable', `Request to ${host} failed.`, { cause: lastError });
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

import { sameAddress } from '../../domain/address.js';
import { sanitizeOptional } from '../../domain/sanitize.js';
import type { AccountRef, Asset, HistoryItem, JettonBalance, NftItem, Page } from '../../engine/types.js';
import { getJson } from '../http.js';
import type { HistoryQuery, IndexerPort, JettonMeta } from '../IndexerPort.js';

/**
 * Parse an indexer-supplied amount into bigint without ever throwing: a single
 * malformed/oversized transfer must not break the whole page. Non-integer or junk
 * values collapse to 0n. (A JSON `number` above 2^53 has already lost precision at
 * JSON.parse — the indexer returns amounts as strings, so this is a defensive floor.)
 */
function safeBigInt(v: string | number | undefined | null): bigint {
  if (v === undefined || v === null) return 0n;
  try {
    if (typeof v === 'number') return Number.isFinite(v) ? BigInt(Math.trunc(v)) : 0n;
    const s = v.trim();
    return /^-?\d+$/.test(s) ? BigInt(s) : 0n;
  } catch {
    return 0n;
  }
}

/** Clamp indexer-supplied token decimals to a sane range (some tokens omit/spoof it). */
function safeDecimals(d: number | undefined): number {
  return typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 30 ? d : 9;
}

interface TonApiJettonBalance {
  balance?: string;
  wallet_address?: { address?: string };
  jetton?: {
    address?: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    verification?: string;
    image?: string;
  };
}
interface TonApiJettonsResponse {
  balances?: TonApiJettonBalance[];
}

interface TonApiNftItem {
  address?: string;
  index?: number | string;
  verified?: boolean;
  collection?: { address?: string; name?: string };
  metadata?: { name?: string; image?: string };
}
interface TonApiNftsResponse {
  nft_items?: TonApiNftItem[];
}

interface TonApiJettonInfo {
  metadata?: { name?: string; symbol?: string; decimals?: number | string };
}

// Minimal structural views of the TonAPI `/v2/accounts/{id}/events` response.
interface TonApiAddress {
  address?: string;
}
interface TonApiTonTransfer {
  sender?: TonApiAddress;
  recipient?: TonApiAddress;
  amount?: number | string;
  comment?: string;
}
interface TonApiJettonTransfer {
  sender?: TonApiAddress;
  recipient?: TonApiAddress;
  amount?: string;
  comment?: string;
  jetton?: { address?: string; symbol?: string; decimals?: number };
}
interface TonApiAction {
  type?: string;
  status?: string;
  TonTransfer?: TonApiTonTransfer;
  JettonTransfer?: TonApiJettonTransfer;
  simple_preview?: { description?: string };
}
interface TonApiEvent {
  event_id?: string;
  timestamp?: number;
  actions?: TonApiAction[];
}
interface TonApiEventsResponse {
  events?: TonApiEvent[];
  next_from?: number;
}

export class TonApiClient implements IndexerPort {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async getHistory(account: AccountRef, query: HistoryQuery = {}): Promise<Page<HistoryItem>> {
    const params = new URLSearchParams({ limit: String(query.limit ?? 20) });
    if (query.cursor) params.set('before_lt', query.cursor);
    const url = `${this.baseUrl}/v2/accounts/${encodeURIComponent(account.address)}/events?${params.toString()}`;
    const data = await getJson<TonApiEventsResponse>(url, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
    });

    const items: HistoryItem[] = [];
    for (const event of data.events ?? []) {
      for (const action of event.actions ?? []) {
        items.push(this.#mapAction(action, event, account));
      }
    }
    return { items, nextCursor: data.next_from ? String(data.next_from) : undefined };
  }

  async getJettons(account: AccountRef): Promise<JettonBalance[]> {
    const url = `${this.baseUrl}/v2/accounts/${encodeURIComponent(account.address)}/jettons`;
    const data = await getJson<TonApiJettonsResponse>(url, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
    });
    return (data.balances ?? [])
      .map((b) => ({
        master: b.jetton?.address ?? '',
        walletAddress: b.wallet_address?.address ?? '',
        amount: safeBigInt(b.balance),
        decimals: safeDecimals(b.jetton?.decimals),
        symbol: sanitizeOptional(b.jetton?.symbol, { maxLen: 32 }),
        name: sanitizeOptional(b.jetton?.name, { maxLen: 64 }),
        image: b.jetton?.image,
        verified: b.jetton?.verification === 'whitelist',
        verification:
          b.jetton?.verification === 'whitelist'
            ? ('whitelist' as const)
            : b.jetton?.verification === 'blacklist'
              ? ('blacklist' as const)
              : ('none' as const),
      }))
      .filter((j) => j.master !== '');
  }

  async getNfts(account: AccountRef): Promise<NftItem[]> {
    const url = `${this.baseUrl}/v2/accounts/${encodeURIComponent(account.address)}/nfts?limit=200&indirect_ownership=false`;
    const data = await getJson<TonApiNftsResponse>(url, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
    });
    return (data.nft_items ?? [])
      .map((n) => ({
        address: n.address ?? '',
        name: sanitizeOptional(n.metadata?.name, { maxLen: 80 }),
        collectionName: sanitizeOptional(n.collection?.name, { maxLen: 80 }),
        collectionAddress: n.collection?.address,
        image: n.metadata?.image,
        index: n.index === undefined ? undefined : String(n.index),
        verified: n.verified,
      }))
      .filter((n) => n.address !== '');
  }

  async getJettonMeta(master: string): Promise<JettonMeta | undefined> {
    if (!master) return undefined;
    const url = `${this.baseUrl}/v2/jettons/${encodeURIComponent(master)}`;
    try {
      const data = await getJson<TonApiJettonInfo>(url, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      });
      const meta = data.metadata;
      if (!meta) return undefined;
      const decimalsRaw = typeof meta.decimals === 'string' ? Number.parseInt(meta.decimals, 10) : meta.decimals;
      return {
        decimals: safeDecimals(typeof decimalsRaw === 'number' ? decimalsRaw : undefined),
        symbol: sanitizeOptional(meta.symbol, { maxLen: 32 }),
        name: sanitizeOptional(meta.name, { maxLen: 64 }),
      };
    } catch {
      // Metadata is best-effort; a lookup failure must not block an approval prompt.
      return undefined;
    }
  }

  #mapAction(action: TonApiAction, event: TonApiEvent, account: AccountRef): HistoryItem {
    const base = {
      hash: event.event_id ?? '',
      timestamp: event.timestamp ?? 0,
      status: (action.status === 'ok' ? 'success' : 'failed') as HistoryItem['status'],
    };

    if (action.TonTransfer) {
      const t = action.TonTransfer;
      const direction = this.#direction(t.sender?.address, t.recipient?.address, account);
      return {
        ...base,
        direction,
        asset: 'TON',
        amount: safeBigInt(t.amount),
        counterparty: direction === 'out' ? t.recipient?.address : t.sender?.address,
        comment: sanitizeOptional(t.comment, { maxLen: 200 }),
      };
    }

    if (action.JettonTransfer) {
      const j = action.JettonTransfer;
      const direction = this.#direction(j.sender?.address, j.recipient?.address, account);
      const asset: Asset = {
        jettonMaster: j.jetton?.address ?? '',
        symbol: sanitizeOptional(j.jetton?.symbol, { maxLen: 32 }),
        decimals: safeDecimals(j.jetton?.decimals),
      };
      return {
        ...base,
        direction,
        asset,
        amount: safeBigInt(j.amount),
        counterparty: direction === 'out' ? j.recipient?.address : j.sender?.address,
        comment: sanitizeOptional(j.comment, { maxLen: 200 }),
      };
    }

    // Anything else (deploys, contract calls): a 0-amount entry with a description.
    return {
      ...base,
      direction: 'self',
      asset: 'TON',
      amount: 0n,
      comment: sanitizeOptional(action.simple_preview?.description ?? action.type, { maxLen: 200 }),
    };
  }

  #direction(
    from: string | undefined,
    to: string | undefined,
    account: AccountRef,
  ): HistoryItem['direction'] {
    const isFrom = from !== undefined && sameAddress(from, account.rawAddress);
    const isTo = to !== undefined && sameAddress(to, account.rawAddress);
    if (isFrom && isTo) return 'self';
    return isFrom ? 'out' : 'in';
  }
}

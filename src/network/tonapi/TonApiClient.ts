import { sameAddress } from '../../domain/address.js';
import type { AccountRef, Asset, HistoryItem, Page } from '../../engine/types.js';
import { getJson } from '../http.js';
import type { HistoryQuery, IndexerPort } from '../IndexerPort.js';

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
        amount: BigInt(t.amount ?? 0),
        counterparty: direction === 'out' ? t.recipient?.address : t.sender?.address,
        comment: t.comment,
      };
    }

    if (action.JettonTransfer) {
      const j = action.JettonTransfer;
      const direction = this.#direction(j.sender?.address, j.recipient?.address, account);
      const asset: Asset = {
        jettonMaster: j.jetton?.address ?? '',
        symbol: j.jetton?.symbol,
        decimals: j.jetton?.decimals ?? 9,
      };
      return {
        ...base,
        direction,
        asset,
        amount: BigInt(j.amount ?? 0),
        counterparty: direction === 'out' ? j.recipient?.address : j.sender?.address,
        comment: j.comment,
      };
    }

    // Anything else (deploys, contract calls): a 0-amount entry with a description.
    return {
      ...base,
      direction: 'self',
      asset: 'TON',
      amount: 0n,
      comment: action.simple_preview?.description ?? action.type,
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

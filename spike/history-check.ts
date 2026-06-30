/* eslint-disable */
/** Verify TonApiClient.getHistory mapping against a real, active testnet address. */
import { TonApiClient } from '../src/network/tonapi/TonApiClient.js';

const elector = '-1:5555555555555555555555555555555555555555555555555555555555555555';
const client = new TonApiClient('https://testnet.tonapi.io');
const acct = {
  address: elector,
  rawAddress: elector,
  workchain: -1,
  version: 'v5r1' as const,
  publicKey: '',
  network: 'testnet' as const,
};

const page = await client.getHistory(acct, { limit: 5 });
console.log('items:', page.items.length, '| nextCursor:', page.nextCursor ?? '(none)');
for (const it of page.items.slice(0, 5)) {
  console.log(
    ` ${new Date(it.timestamp * 1000).toISOString().slice(0, 19)}  ${it.direction}  ` +
      `${it.amount} ${it.asset === 'TON' ? 'TON' : 'jetton'}  ${it.status}  ${it.comment ?? ''}`.trim(),
  );
}

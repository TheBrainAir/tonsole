/* eslint-disable */
/** Verify TonApiClient.getJettons mapping against a real address that holds jettons. */
import { TonApiClient } from '../src/network/tonapi/TonApiClient.js';
import { formatAmount } from '../src/domain/amount.js';

const addr = 'EQB3ncyBUTjZUA5EnFKR5_EnOMI9V1tTEAAPaiU71gc4TiUt'; // STON.fi router (mainnet)
const client = new TonApiClient('https://tonapi.io');
const acct = {
  address: addr,
  rawAddress: addr,
  workchain: 0,
  version: 'v5r1' as const,
  publicKey: '',
  network: 'mainnet' as const,
};

const jettons = await client.getJettons(acct);
console.log('jetton count:', jettons.length);
for (const j of jettons.slice(0, 6)) {
  console.log(
    ` ${(j.symbol ?? 'jetton').padEnd(8)} ${formatAmount(j.amount, j.decimals).padStart(16)} (dec ${j.decimals})  verified=${j.verified}  ${j.master.slice(0, 10)}…`,
  );
}

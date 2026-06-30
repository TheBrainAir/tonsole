/* eslint-disable */
import { TonApiClient } from '../src/network/tonapi/TonApiClient.js';
import { renderImagePreview } from '../src/shared/image.js';

const c = new TonApiClient('https://tonapi.io');
const a = 'EQDrLq-X6jKZNHAScgghh0h1iog3StK71zn8dcmrOj8jPWRA';
const nfts = await c.getNfts({
  address: a, rawAddress: a, workchain: 0, version: 'v5r1' as const, publicKey: '', network: 'mainnet' as const,
});
const withImg = nfts.find((n) => n.image);
console.log('image url:', withImg?.image);
const out = await renderImagePreview(withImg!.image!, { width: 24, height: 12 });
console.log('rendered:', out ? `${out.length} chars / ${out.split('\n').length} lines` : 'NULL');
if (out) console.log(out);
process.exit(0);

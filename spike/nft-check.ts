/* eslint-disable */
/** Verify TonApiClient.getNfts mapping against a real mainnet address. */
import { TonApiClient } from '../src/network/tonapi/TonApiClient.js';

const addr = process.argv[2] ?? 'EQDrLq-X6jKZNHAScgghh0h1iog3StK71zn8dcmrOj8jPWRA'; // a known NFT holder (mainnet)
const client = new TonApiClient('https://tonapi.io');
const acct = {
  address: addr,
  rawAddress: addr,
  workchain: 0,
  version: 'v5r1' as const,
  publicKey: '',
  network: 'mainnet' as const,
};

const nfts = await client.getNfts(acct);
console.log('nft count:', nfts.length);
for (const n of nfts.slice(0, 6)) {
  console.log(
    ` ${(n.name ?? '(unnamed)').padEnd(24)} · ${(n.collectionName ?? '-').padEnd(18)} · verified=${n.verified} · ${n.address.slice(0, 12)}…`,
  );
}

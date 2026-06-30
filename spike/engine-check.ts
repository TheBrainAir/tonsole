/* eslint-disable */
/**
 * Runtime smoke test for the WalletKitEngine against real testnet (no secrets at
 * risk: a fresh random account with zero balance). Run: npx tsx spike/engine-check.ts
 */
import { WalletKitEngine } from '../src/engine/walletkit/WalletKitEngine.js';
import { formatTon } from '../src/domain/amount.js';

const engine = new WalletKitEngine({ network: 'testnet', toncenterUrl: 'https://testnet.toncenter.com' });
console.log('init…');
await engine.init();
console.log('engine id:', engine.id);

const mnemonic = await engine.generateMnemonic();
console.log('mnemonic words:', mnemonic.length, '| valid:', await engine.validateMnemonic(mnemonic));

const acct = await engine.deriveAccount(mnemonic, { network: 'testnet' });
console.log('derived account:');
console.log('  address  :', acct.address);
console.log('  raw      :', acct.rawAddress);
console.log('  workchain:', acct.workchain, '| version:', acct.version);
console.log('  pubkey   :', acct.publicKey.slice(0, 24) + '…');

const bal = await engine.getBalance(acct);
console.log('balance   :', formatTon(bal.nano), 'TON', `(${bal.nano} nano)`);

await engine.dispose();
console.log('done ✓');

/* eslint-disable */
/** Verify the TON Connect engine wiring under Node (EventSource polyfill + handle). */
import { WalletKitEngine } from '../src/engine/walletkit/WalletKitEngine.js';

const engine = new WalletKitEngine({ network: 'testnet', toncenterUrl: 'https://testnet.toncenter.com' });
await engine.init();
console.log('EventSource polyfilled:', typeof (globalThis as any).EventSource === 'function');
const tc = engine.tonConnect();
console.log('tonConnect handle methods:', Object.keys(tc).join(', '));
console.log('submitUrl/unlock/onTransactionRequest present:',
  typeof tc.submitUrl === 'function' && typeof tc.unlock === 'function' && typeof tc.onTransactionRequest === 'function');
await engine.dispose();
console.log('ok');
process.exit(0);

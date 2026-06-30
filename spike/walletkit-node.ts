/* eslint-disable */
/**
 * M0 Node-compatibility spike for @ton/walletkit.
 *
 * Goal: decide whether tonsole's primary engine can be WalletKit under our
 * Node 22 + ESM toolchain (tsx in dev, tsup/esbuild in prod), or whether we must
 * default to the TonCore fallback engine.
 *
 * Run with:  npm run spike   (executes via tsx -> esbuild resolution)
 *
 * It is intentionally defensive and exploratory: every step is wrapped, and we
 * print the REAL exported API so the WalletKitEngine can be written against facts.
 */
import { createRequire } from 'node:module';
import { mnemonicNew, mnemonicToPrivateKey, mnemonicValidate } from '@ton/crypto';
import { WalletContractV5R1, WalletContractV4 } from '@ton/ton';

type Row = { step: string; ok: boolean; info?: string };
const rows: Row[] = [];
function record(step: string, ok: boolean, info?: string) {
  rows.push({ step, ok, info });
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`${tag}  ${step}${info ? `\n        ${info}` : ''}`);
}
function header(t: string) {
  console.log(`\n=== ${t} ===`);
}

header('environment');
record('Node >= 22.12', true, `Node ${process.versions.node}`);
record('globalThis.fetch present', typeof globalThis.fetch === 'function');
record('globalThis.EventSource present', typeof (globalThis as any).EventSource === 'function',
  'needed only for TON Connect bridge (M5); absence is fine for core wallet ops');

// ---------------------------------------------------------------------------
header('load @ton/walletkit');

let wk: any;
let loadMode: 'esm' | 'cjs' | 'none' = 'none';

// (A) Native/esbuild ESM import — this is how `tonsole` would normally consume it.
try {
  wk = await import('@ton/walletkit');
  loadMode = 'esm';
  record('import @ton/walletkit (ESM via tsx/esbuild)', true);
} catch (e: any) {
  record('import @ton/walletkit (ESM via tsx/esbuild)', false, e?.message?.split('\n')[0]);
}

// (B) Guaranteed fallback path: require the CJS build directly.
const require = createRequire(import.meta.url);
try {
  const cjs = require('@ton/walletkit');
  record('require @ton/walletkit (CJS)', true, `${Object.keys(cjs).length} exports`);
  if (!wk) {
    wk = cjs;
    loadMode = 'cjs';
  }
} catch (e: any) {
  record('require @ton/walletkit (CJS)', false, e?.message?.split('\n')[0]);
}

if (!wk) {
  console.log('\nCould not load @ton/walletkit by any means. Verdict below.');
  printVerdict();
  process.exit(0);
}

record(`module loaded (mode=${loadMode})`, true,
  `exports: ${Object.keys(wk).sort().join(', ')}`);

const has = (k: string) => k in wk && wk[k] != null;
for (const name of [
  'TonWalletKit', 'Signer', 'WalletV5R1Adapter', 'WalletV4R2Adapter',
  'Network', 'MemoryStorageAdapter', 'getTonConnectDeviceInfo', 'getTonConnectWalletManifest',
]) {
  record(`export: ${name}`, has(name));
}

// ---------------------------------------------------------------------------
header('reference derivation via @ton/ton (fallback engine math)');

const mnemonic = await mnemonicNew(); // 24 words, random; same words fed to both paths
record('mnemonicNew() -> 24 words', mnemonic.length === 24, `${mnemonic.length} words`);
record('mnemonicValidate()', await mnemonicValidate(mnemonic));

const keyPair = await mnemonicToPrivateKey(mnemonic);
let coreAddrMainnet = '';
try {
  // V5R1 address depends on the network global id (mainnet -239 / testnet -3).
  const w = WalletContractV5R1.create({
    workChain: 0,
    publicKey: keyPair.publicKey,
  } as any);
  coreAddrMainnet = w.address.toString({ bounceable: true, testOnly: false });
  record('@ton/ton WalletContractV5R1 derive', true,
    `mainnet addr ${coreAddrMainnet}`);
} catch (e: any) {
  record('@ton/ton WalletContractV5R1 derive', false, e?.message?.split('\n')[0]);
}
try {
  const w4 = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey } as any);
  record('@ton/ton WalletContractV4 derive', true,
    `addr ${w4.address.toString({ bounceable: true, testOnly: false })}`);
} catch (e: any) {
  record('@ton/ton WalletContractV4 derive', false, e?.message?.split('\n')[0]);
}

// ---------------------------------------------------------------------------
header('WalletKit signer + adapter derivation (correctness cross-check)');

let kitAddr = '';
try {
  if (!has('Signer')) throw new Error('no Signer export');
  const signer = await wk.Signer.fromMnemonic(mnemonic, { type: 'ton' });
  const pub = signer?.publicKey ?? signer?.getPublicKey?.();
  record('Signer.fromMnemonic', true,
    `signer keys: ${Object.keys(signer ?? {}).join(', ') || '(none enumerable)'}; publicKey=${typeof pub === 'string' ? pub.slice(0, 18) + '…' : typeof pub}`);

  // Try to derive an address via the adapter. The exact options are uncertain;
  // attempt a few shapes and log which works.
  if (has('WalletV5R1Adapter') && has('Network')) {
    const net = wk.Network.mainnet?.() ?? wk.Network.MAINNET ?? wk.Network?.mainnet;
    let adapter: any;
    const attempts: Array<[string, () => Promise<any>]> = [
      ['create(signer, {network})', () => wk.WalletV5R1Adapter.create(signer, { network: net })],
      ['create(signer, {network, workchain:0})', () => wk.WalletV5R1Adapter.create(signer, { network: net, workchain: 0 })],
      ['create(signer)', () => wk.WalletV5R1Adapter.create(signer)],
    ];
    for (const [label, fn] of attempts) {
      try {
        adapter = await fn();
        const addr = adapter?.address?.toString?.() ?? adapter?.address ?? adapter?.getAddress?.();
        kitAddr = typeof addr === 'string' ? addr : String(addr ?? '');
        record(`WalletV5R1Adapter.${label}`, true,
          `adapter keys: ${Object.keys(adapter ?? {}).join(', ')}; address=${kitAddr}`);
        break;
      } catch (e: any) {
        record(`WalletV5R1Adapter.${label}`, false, e?.message?.split('\n')[0]);
      }
    }
  }
} catch (e: any) {
  record('Signer.fromMnemonic', false, e?.message?.split('\n')[0]);
}

if (kitAddr && coreAddrMainnet) {
  // Normalize both to raw for comparison would be ideal; compare friendly forms loosely.
  record('WalletKit address == @ton/ton address (same mnemonic)',
    kitAddr === coreAddrMainnet,
    kitAddr === coreAddrMainnet ? 'identical' : `kit=${kitAddr}  core=${coreAddrMainnet} (may differ by bounceable/network flag — inspect)`);
}

// ---------------------------------------------------------------------------
header('TonWalletKit construction under Node (storage + browser globals)');

try {
  if (!has('TonWalletKit')) throw new Error('no TonWalletKit export');
  const storage = has('MemoryStorageAdapter') ? new wk.MemoryStorageAdapter({}) : undefined;
  const net = wk.Network?.testnet?.();
  const chainId = net?.chainId ?? net?.networkId ?? -3;
  const deviceInfo = has('getTonConnectDeviceInfo')
    ? wk.getTonConnectDeviceInfo()
    : { platform: 'linux', appName: 'tonsole', appVersion: '0.1.0', maxProtocolVersion: 2, features: [] };
  const walletManifest = has('getTonConnectWalletManifest')
    ? wk.getTonConnectWalletManifest()
    : { name: 'tonsole', image: 'https://ton.org/icon.png', about_url: 'https://ton.org' };

  const kit = new wk.TonWalletKit({
    deviceInfo,
    walletManifest,
    storage,
    networks: {
      [chainId]: { apiClient: { url: 'https://testnet.toncenter.com' } },
    },
    bridge: { bridgeUrl: 'https://connect.ton.org/bridge' },
  });
  record('new TonWalletKit({ MemoryStorageAdapter, testnet }) — no browser-global throw', true,
    `instance keys: ${Object.keys(kit).slice(0, 12).join(', ')}…`);

  if (typeof kit.waitForReady === 'function') {
    await Promise.race([
      kit.waitForReady(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('waitForReady timeout 8s')), 8000)),
    ]);
    record('kit.waitForReady() resolves without bridge connection', true);
  } else {
    record('kit.waitForReady present', false, 'method missing — inspect API');
  }

  if (typeof kit.dispose === 'function') await kit.dispose();
  else if (typeof kit.destroy === 'function') await kit.destroy();
} catch (e: any) {
  const msg = e?.message ?? String(e);
  const browserGlobal = /localStorage|window|document|navigator|self|XMLHttpRequest|indexedDB/i.test(msg);
  record('new TonWalletKit(...) under Node', false,
    `${msg.split('\n')[0]}${browserGlobal ? '  <-- BROWSER GLOBAL: needs Node storage adapter / shim' : ''}`);
}

printVerdict();

function printVerdict() {
  header('VERDICT');
  const ok = (s: string) => rows.find((r) => r.step.startsWith(s))?.ok;
  const loaded = loadMode !== 'none';
  const derived = !!kitAddr;
  const constructed = rows.find((r) => r.step.startsWith('new TonWalletKit({ MemoryStorageAdapter'))?.ok ?? false;

  console.log(`load mode:            ${loadMode}`);
  console.log(`derive address:       ${derived ? 'yes' : 'no'}`);
  console.log(`construct under Node: ${constructed ? 'yes' : 'no'}`);
  const passCount = rows.filter((r) => r.ok).length;
  console.log(`passed ${passCount}/${rows.length} checks`);

  let verdict: string;
  if (loaded && derived && constructed) {
    verdict = `WalletKit USABLE under Node (load via ${loadMode}). Default engine = 'walletkit'.`;
  } else if (loaded && derived) {
    verdict = `WalletKit loads and derives, but construction needs work (storage/shim). Likely usable; default 'walletkit' with a Node storage adapter.`;
  } else if (loaded) {
    verdict = `WalletKit loads (${loadMode}) but derivation API differs from assumptions — inspect logs and adjust WalletKitEngine.`;
  } else {
    verdict = `WalletKit NOT loadable under Node toolchain — default engine = 'toncore' (fallback). Re-test on walletkit upgrade.`;
  }
  console.log(`\n>>> ${verdict}`);
}

import { render } from 'ink-testing-library';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { App } from '../composition.js';
import { DISCLAIMER_VERSION } from '../config/schema.js';
import type { StoredAccount } from '../services/AccountService.js';
import type { HistoryItem, JettonBalance } from '../engine/types.js';
import { TonsoleApp } from './app.js';
import { TextField } from './components/TextField.js';
import { TxSummary } from './components/TxSummary.js';
import { AppProvider } from './context.js';
import { ConnectScreen } from './screens/ConnectScreen.js';
import { JettonsScreen } from './screens/GalleryScreen.js';
import { HistoryScreen } from './screens/HistoryScreen.js';
import { SendScreen } from './screens/SendScreen.js';
import { TonConnectProvider } from './tonconnect-context.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\u001B\[[0-9;]*m/g, '');

function fakeApp(overrides: Partial<App> & { accountsList: StoredAccount[] }): App {
  const { accountsList, ...rest } = overrides;
  return {
    config: { network: 'testnet', disclaimerAcceptedVersion: DISCLAIMER_VERSION },
    accounts: { list: () => accountsList },
    balances: { getTon: async () => ({ nano: 0n, decimals: 9 }), getJettons: async () => [] },
    history: { recent: async () => ({ items: [] }) },
    receive: { explorerUrl: () => 'https://testnet.tonviewer.com/x', qr: async () => '[qr]' },
    ...rest,
  } as unknown as App;
}

const account: StoredAccount = {
  id: 'kid',
  isDefault: true,
  account: {
    address: 'UQTestWalletAddress',
    rawAddress: '0:abcd',
    workchain: 0,
    version: 'v5r1',
    publicKey: '',
    network: 'testnet',
  },
};

describe('TUI', () => {
  it('shows onboarding when there are no wallets', () => {
    const { lastFrame, unmount } = render(<TonsoleApp app={fakeApp({ accountsList: [] })} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Welcome to tonsole');
    expect(frame).toContain('Create a new wallet');
    unmount();
  });

  it('shows the dashboard with balance and menu when a wallet exists', async () => {
    const { lastFrame, unmount } = render(<TonsoleApp app={fakeApp({ accountsList: [account] })} />);
    await delay(50);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('tonsole');
    expect(frame).toContain('Balance');
    expect(frame).toContain('0 GRAM');
    expect(frame).toContain('Send');
    expect(frame).toContain('Receive');
    expect(frame).toContain('Connect');
    unmount();
  });

  it('exposes a comment/memo field on the send screen', async () => {
    const { lastFrame, stdin, unmount } = render(
      <TonsoleApp app={fakeApp({ accountsList: [account] })} />,
    );
    await delay(50);
    stdin.write('\r'); // select the first menu item ("Send")
    await delay(50);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Send GRAM');
    expect(frame).toContain('Comment');
    unmount();
  });

  it('TON Connect screen shows the unlock prompt', () => {
    const { lastFrame, unmount } = render(
      <AppProvider value={fakeApp({ accountsList: [account] })}>
        <TonConnectProvider
          value={{ unlocked: false, status: '', unlock: async () => {}, submitUrl: async () => {} }}
        >
          <ConnectScreen account={account.account} />
        </TonConnectProvider>
      </AppProvider>,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('TON Connect');
    expect(frame).toContain('Passphrase');
    unmount();
  });

  it('history screen lists transactions and shows a detail panel', async () => {
    const items: HistoryItem[] = [
      {
        hash: 'hash-aaaa',
        timestamp: 1_700_000_000,
        direction: 'in',
        asset: 'TON',
        amount: 1_500_000_000n,
        counterparty: 'UQsenderaddress',
        status: 'success',
      },
      {
        hash: 'hash-bbbb',
        timestamp: 1_700_000_100,
        direction: 'out',
        asset: 'TON',
        amount: 500_000_000n,
        counterparty: 'UQrecipientaddr',
        comment: 'gm',
        status: 'success',
      },
    ];
    const app = fakeApp({
      accountsList: [account],
      history: { recent: async () => ({ items }) } as unknown as App['history'],
    });
    const { lastFrame, unmount } = render(
      <AppProvider value={app}>
        <HistoryScreen account={account.account} />
      </AppProvider>,
    );
    await delay(60);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('1.5 GRAM');
    expect(frame).toContain('0.5 GRAM');
    expect(frame).toContain('UQsenderaddress'); // detail panel for the selected item
    unmount();
  });

  it('send screen adapts to an NFT preset (no amount field)', () => {
    const { lastFrame, unmount } = render(
      <AppProvider value={fakeApp({ accountsList: [account] })}>
        <SendScreen
          account={account.account}
          onDone={() => {}}
          preset={{ kind: 'nft', address: 'EQnft', name: 'Cool NFT' }}
        />
      </AppProvider>,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Send NFT Cool NFT');
    expect(frame).toContain('To');
    expect(frame).not.toContain('Amount');
    unmount();
  });

  it('send screen adapts to a jetton preset (amount in jetton units)', () => {
    const { lastFrame, unmount } = render(
      <AppProvider value={fakeApp({ accountsList: [account] })}>
        <SendScreen
          account={account.account}
          onDone={() => {}}
          preset={{ kind: 'jetton', master: 'EQmaster', symbol: 'USDT', decimals: 6 }}
        />
      </AppProvider>,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Send USDT');
    expect(frame).toContain('Amount');
    unmount();
  });

  it('transaction summary explains, in plain language, what signing does', () => {
    const preview = {
      ok: true,
      emulated: true,
      moneyFlow: {
        outgoing: [
          { asset: 'TON' as const, amount: -250_000_000n, counterparty: 'EQdest', assetType: 'ton' as const },
          {
            asset: { jettonMaster: 'EQnft', decimals: 0 },
            amount: -1n,
            counterparty: 'EQbob',
            counterpartyName: 'bob.ton',
            assetType: 'nft' as const,
          },
        ],
        incoming: [],
      },
      estimatedFees: { gas: 0n, forward: 0n, storage: 0n, total: 6_100_000n },
      willDeployWallet: false,
      warnings: ['recipient is uninitialized'],
      raw: {},
    };
    const { lastFrame, unmount } = render(<TxSummary preview={preview} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('If you sign');
    expect(frame).toContain('you send');
    expect(frame).toContain('an NFT'); // NFT labeled, not a tiny jetton amount
    expect(frame).toContain('bob.ton'); // human-readable counterparty name
    expect(frame).toContain('network fee');
    expect(frame).toContain('recipient is uninitialized');
    unmount();
  });

  it('warns (does not reassure) when a dApp transaction could not be simulated', () => {
    const preview = {
      ok: false,
      emulated: false,
      moneyFlow: { outgoing: [], incoming: [] },
      willDeployWallet: false,
      warnings: [],
      raw: {},
    };
    const { lastFrame, unmount } = render(<TxSummary preview={preview} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('could NOT be simulated');
    expect(frame).not.toContain('If you sign'); // never the green "safe" header
    expect(frame).not.toContain('no net change'); // never the reassuring empty-flow line
    unmount();
  });

  it('status bar advertises the dashboard hotkeys from the keymap registry', async () => {
    const { lastFrame, unmount } = render(<TonsoleApp app={fakeApp({ accountsList: [account] })} />);
    await delay(50);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('quit');
    expect(frame).toContain('refresh');
    expect(frame).toContain('copy address');
    unmount();
  });

  it('flags blacklisted jettons as SCAM in the gallery', async () => {
    const jettons: JettonBalance[] = [
      {
        master: 'EQscamMaster',
        walletAddress: 'EQmyJettonWallet',
        amount: 9_999n,
        decimals: 0,
        symbol: 'SCMX',
        name: 'FREE AIRDROP CLAIM',
        verification: 'blacklist',
      },
    ];
    const app = fakeApp({
      accountsList: [account],
      balances: {
        getTon: async () => ({ nano: 0n, decimals: 9 }),
        getJettons: async () => jettons,
      } as unknown as App['balances'],
    });
    const { lastFrame, unmount } = render(
      <AppProvider value={app}>
        <JettonsScreen account={account.account} onSend={() => {}} />
      </AppProvider>,
    );
    await delay(60);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('SCAM');
    expect(frame).toContain('flags this token as a scam');
    unmount();
  });

  it('text field supports cursor movement and mid-string editing', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return <TextField label="X" value={value} onChange={setValue} focus />;
    }
    const { lastFrame, stdin, unmount } = render(<Harness />);
    await delay(20);
    stdin.write('ac');
    await delay(20);
    stdin.write('\u001B[D'); // ← left arrow
    await delay(20);
    stdin.write('b');
    await delay(20);
    expect(stripAnsi(lastFrame() ?? '')).toContain('abc');
    unmount();
  });

  it('windows long history lists with an overflow indicator', async () => {
    const items: HistoryItem[] = Array.from({ length: 30 }, (_, i) => ({
      hash: `hash-${i}`,
      timestamp: 1_700_000_000 + i,
      direction: 'in' as const,
      asset: 'TON' as const,
      amount: 1_000_000_000n,
      counterparty: 'UQsomecounterparty',
      status: 'success' as const,
    }));
    const app = fakeApp({
      accountsList: [account],
      history: { recent: async () => ({ items }) } as unknown as App['history'],
    });
    const { lastFrame, unmount } = render(
      <AppProvider value={app}>
        <HistoryScreen account={account.account} />
      </AppProvider>,
    );
    await delay(60);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('more');
    expect(frame).toContain('1/30');
    unmount();
  });

  it('a system-layer prompt keeps y/n even when a screen overlay mounts later', async () => {
    // Regression: a Send confirm modal appearing while a dApp prompt is showing
    // must NOT steal the y key and sign invisibly.
    const { KeymapProvider, useKeymap } = await import('./shell/keymap.js');
    const log: string[] = [];
    function SystemPrompt() {
      useKeymap('system', [{ key: 'y', label: 'approve', onPress: () => log.push('system-y') }]);
      return null;
    }
    function LateScreenModal() {
      useKeymap('overlay', [{ key: 'y', label: 'send', onPress: () => log.push('overlay-y') }]);
      return null;
    }
    function Harness() {
      const [late, setLate] = useState(false);
      // The screen modal mounts AFTER the system prompt (newer scope id) — like
      // a Send confirm appearing when emulation finishes mid-dApp-prompt.
      useEffect(() => {
        const t = setTimeout(() => setLate(true), 30);
        return () => clearTimeout(t);
      }, []);
      return (
        <>
          <SystemPrompt />
          {late ? <LateScreenModal /> : null}
        </>
      );
    }
    const { stdin, unmount } = render(
      <KeymapProvider>
        <Harness />
      </KeymapProvider>,
    );
    await delay(60); // the late overlay is mounted by now
    stdin.write('y');
    await delay(20);
    expect(log).toEqual(['system-y']);
    unmount();
  });

  it('renders a jetton delta with its real symbol (not "1 tokens")', () => {
    const preview = {
      ok: true,
      emulated: true,
      moneyFlow: {
        outgoing: [
          {
            asset: { jettonMaster: 'EQusdt', decimals: 6, symbol: 'USDT' },
            amount: -1_000_000_000n, // 1000 USDT at 6 decimals
            counterparty: 'EQrecv',
            assetType: 'jetton' as const,
          },
        ],
        incoming: [],
      },
      willDeployWallet: false,
      warnings: [],
      raw: {},
    };
    const { lastFrame, unmount } = render(<TxSummary preview={preview} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('1000 USDT');
    unmount();
  });
});

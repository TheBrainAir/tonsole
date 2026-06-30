import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type { App } from '../composition.js';
import type { StoredAccount } from '../services/AccountService.js';
import type { HistoryItem } from '../engine/types.js';
import { TonsoleApp } from './app.js';
import { AppProvider } from './context.js';
import { ConnectScreen } from './screens/ConnectScreen.js';
import { HistoryScreen } from './screens/HistoryScreen.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeApp(overrides: Partial<App> & { accountsList: StoredAccount[] }): App {
  const { accountsList, ...rest } = overrides;
  return {
    config: { network: 'testnet' },
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
        <ConnectScreen account={account.account} />
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
});

import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type { App } from '../composition.js';
import type { StoredAccount } from '../services/AccountService.js';
import { TonsoleApp } from './app.js';

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
    unmount();
  });
});

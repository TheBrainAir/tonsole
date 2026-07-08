import { Box, Text } from 'ink';
import { shortenAddress } from '../../domain/address.js';
import { formatAmount, formatCoin } from '../../domain/amount.js';
import type { AccountRef, HistoryItem } from '../../engine/types.js';
import { copyToClipboard, openUrl } from '../../shared/system.js';
import type { Screen } from '../app.js';
import { AsyncView } from '../components/AsyncView.js';
import { ListView, MenuRow } from '../components/ListView.js';
import { Panel } from '../components/Panel.js';
import { Spinner } from '../components/Spinner.js';
import { TonAmount } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';
import { useKeymap } from '../shell/keymap.js';
import { useFlash } from '../shell/StatusBar.js';
import { useViewport } from '../shell/viewport.js';
import { color, symbol } from '../theme.js';
import { useTonConnect } from '../tonconnect-context.js';

export function DashboardScreen({
  account,
  onNavigate,
}: {
  account: AccountRef;
  onNavigate: (screen: Screen) => void;
}) {
  const app = useApp();
  const viewport = useViewport();
  const flash = useFlash();
  const tc = useTonConnect();
  const balance = useAsync(async () => app.balances.getTon(account), [account.address]);
  const jettons = useAsync(async () => app.balances.getJettons(account), [account.address]);
  const nfts = useAsync(async () => app.nfts.list(account), [account.address]);
  const history = useAsync(async () => app.history.recent(account, { limit: 5 }), [account.address]);

  useKeymap('screen', [
    { key: '↑↓', label: 'move' },
    { key: '⏎', label: 'open' },
    { key: 'h', label: 'history', onPress: () => onNavigate('history') },
    {
      key: 'c',
      label: 'copy address',
      onPress: () => {
        void copyToClipboard(account.address)
          .then(() => flash('✓ address copied'))
          .catch(() => flash('✗ could not access the clipboard', 'danger'));
      },
    },
    {
      key: 'o',
      label: 'explorer',
      onPress: () => {
        openUrl(app.receive.explorerUrl(account.address));
        flash('✓ opened in tonviewer');
      },
    },
    {
      key: 'r',
      label: 'refresh',
      onPress: () => {
        balance.reload();
        jettons.reload();
        nfts.reload();
        history.reload();
        flash('refreshing…', 'muted');
      },
    },
  ]);

  const jettonCount = jettons.data?.length ?? 0;
  const flagged = (jettons.data ?? []).filter((j) => j.verification === 'blacklist').length;
  const nftCount = nfts.data?.length ?? 0;
  const walletCount = app.accounts.list().length;
  const sessions = tc.sessions ?? [];

  const menuItems: { label: string; value: Screen; hint?: string }[] = [
    { label: 'Send', value: 'send', hint: 'transfer GRAM or a jetton' },
    { label: 'Receive', value: 'receive', hint: 'address & QR' },
    {
      label: 'Jettons',
      value: 'jettons',
      hint: jettons.data
        ? `${jettonCount} token${jettonCount === 1 ? '' : 's'}${flagged > 0 ? ` ${symbol.bullet} ${flagged} flagged ⚠` : ''}`
        : undefined,
    },
    {
      label: 'NFTs',
      value: 'nft',
      hint: nfts.data ? `${nftCount} item${nftCount === 1 ? '' : 's'}` : undefined,
    },
    { label: 'History', value: 'history' },
    {
      label: 'Connect',
      value: 'connect',
      hint:
        sessions.length > 0
          ? `${sessions.length} dApp${sessions.length === 1 ? '' : 's'} connected`
          : 'link a dApp (TON Connect)',
    },
    {
      label: 'Accounts',
      value: 'accounts',
      hint: `${walletCount} wallet${walletCount === 1 ? '' : 's'}`,
    },
  ];

  const wide = viewport.breakpoint === 'wide';
  // Tight vertical rhythm whenever rows are scarce: the stacked layout needs
  // every row, and even the wide layout must fit short terminals.
  const compact = !wide || viewport.contentRows < 22;
  const balanceRows = compact ? 5 : 7; // title + amount + meta (+ 2 blanks) + borders
  const menuChromeRows = compact ? 3 : 4; // borders + title (+ blank)
  // Rows the menu's ListView cannot use in the left/stacked column.
  const menuReserved = balanceRows + 1 + menuChromeRows;

  const balancePanel = (
    <Panel title="Balance">
      <Box marginTop={compact ? 0 : 1}>
        {balance.loading ? (
          <Spinner />
        ) : balance.error || !balance.data ? (
          <Text color={color.danger}>unavailable — r to retry</Text>
        ) : (
          <TonAmount nano={balance.data.nano} bold />
        )}
      </Box>
      <Box marginTop={compact ? 0 : 1}>
        <Text dimColor wrap="truncate">
          {account.network} {symbol.bullet} wallet {account.version}
          {jettons.data && jettonCount > 0 ? ` ${symbol.bullet} ${jettonCount} jettons` : ''}
          {nfts.data && nftCount > 0 ? ` ${symbol.bullet} ${nftCount} NFTs` : ''}
        </Text>
      </Box>
    </Panel>
  );

  const menuPanel = (
    <Panel title="Menu" marginTop={1}>
      <Box marginTop={compact ? 0 : 1} flexDirection="column">
        <ListView
          items={menuItems}
          wrap
          maxVisible={menuItems.length}
          reservedRows={menuReserved}
          renderItem={(item, { selected }) => (
            <MenuRow label={item.label} hint={item.hint} selected={selected} />
          )}
          onActivate={(item) => onNavigate(item.value)}
        />
      </Box>
    </Panel>
  );

  const recentPanel = (rowCount: number) => (
    <Panel title="Recent activity" flexGrow={wide ? 1 : undefined}>
      <Box marginTop={compact ? 0 : 1} flexDirection="column">
        <AsyncView
          state={history}
          loadingLabel="loading activity…"
          emptyWhen={(page) => page.items.length === 0}
          emptyText="no transactions yet"
          emptyHint="open Receive to get your address"
        >
          {(page) => (
            <>
              {page.items.slice(0, rowCount).map((item, i) => (
                <RecentRow key={i} item={item} />
              ))}
            </>
          )}
        </AsyncView>
      </Box>
    </Panel>
  );

  const connectStrip =
    sessions.length > 0 ? (
      <Panel title="TON Connect" marginTop={1}>
        {sessions.map((s) => (
          <Text key={s.id} wrap="truncate">
            <Text color={color.success}>{symbol.dot}</Text> {s.name ?? 'dApp'}
            {s.url ? <Text dimColor> {s.url}</Text> : null}
          </Text>
        ))}
      </Panel>
    ) : null;

  if (wide) {
    return (
      <Box>
        <Box flexDirection="column" width={46} flexShrink={0}>
          {balancePanel}
          {menuPanel}
        </Box>
        <Box flexDirection="column" flexGrow={1} marginLeft={1}>
          {recentPanel(5)}
          {connectStrip}
        </Box>
      </Box>
    );
  }

  // Stacked: Recent activity only gets what fits under Balance + the full menu.
  const menuFullRows = menuChromeRows + menuItems.length;
  const recentBudget = viewport.contentRows - balanceRows - 1 - menuFullRows - 1;
  const recentCount = Math.min(5, recentBudget - menuChromeRows);
  return (
    <Box flexDirection="column">
      {balancePanel}
      {menuPanel}
      {recentCount >= 1 ? (
        <Box marginTop={1} flexDirection="column">
          {recentPanel(recentCount)}
        </Box>
      ) : null}
      {recentCount >= 1 ? connectStrip : null}
    </Box>
  );
}

function RecentRow({ item }: { item: HistoryItem }) {
  const abs = item.amount < 0n ? -item.amount : item.amount;
  const amount =
    item.asset === 'TON'
      ? formatCoin(abs)
      : `${formatAmount(abs, item.asset.decimals)} ${item.asset.symbol ?? 'jetton'}`;
  const when = new Date(item.timestamp * 1000).toISOString().slice(5, 16).replace('T', ' ');
  return (
    <Text wrap="truncate">
      <Text dimColor>{when} </Text>
      {item.direction === 'out' ? (
        <Text color={color.danger}>− </Text>
      ) : item.direction === 'in' ? (
        <Text color={color.success}>+ </Text>
      ) : (
        <Text dimColor>{symbol.bullet} </Text>
      )}
      {amount}
      {item.status === 'failed' ? <Text color={color.danger}> ✗ failed</Text> : null}
      {item.counterparty ? (
        <Text dimColor>
          {' '}
          {item.direction === 'out' ? 'to' : item.direction === 'in' ? 'from' : ''}{' '}
          {shortenAddress(item.counterparty, { head: 6, tail: 4 })}
        </Text>
      ) : null}
      {item.comment ? <Text dimColor>{` "${item.comment}"`}</Text> : null}
    </Text>
  );
}

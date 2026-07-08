import { Box, Text } from 'ink';
import { useEffect, useRef, useState } from 'react';
import { NETWORKS } from '../../config/networks.js';
import { shortenAddress } from '../../domain/address.js';
import { formatAmount, formatCoin, formatTon } from '../../domain/amount.js';
import type { AccountRef, HistoryItem, NetworkId } from '../../engine/types.js';
import { copyToClipboard, openUrl } from '../../shared/system.js';
import { AsyncView } from '../components/AsyncView.js';
import { ListView } from '../components/ListView.js';
import { Panel } from '../components/Panel.js';
import { Field } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';
import { useKeymap } from '../shell/keymap.js';
import { useFlash } from '../shell/StatusBar.js';
import { useViewport } from '../shell/viewport.js';
import { color, symbol } from '../theme.js';

const PAGE = 50;
type Filter = 'all' | 'in' | 'out' | 'failed';
const FILTERS: Filter[] = ['all', 'in', 'out', 'failed'];

export function HistoryScreen({ account }: { account: AccountRef }) {
  const app = useApp();
  const viewport = useViewport();
  const flash = useFlash();
  const first = useAsync(async () => app.history.recent(account, { limit: PAGE }), [account.address]);

  // Older pages, appended as the user scrolls past the end (cursor pagination).
  const [older, setOlder] = useState<HistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  // Refreshing while a pagination request is in flight must drop that stale
  // response — the epoch bumps whenever the first page is replaced.
  const epochRef = useRef(0);
  useEffect(() => {
    epochRef.current += 1;
    setOlder([]);
    setCursor(first.data?.nextCursor);
  }, [first.data]);

  const items = [...(first.data?.items ?? []), ...older];
  const [filter, setFilter] = useState<Filter>('all');
  const filtered = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'failed') return item.status === 'failed';
    return item.direction === filter;
  });

  const [selected, setSelected] = useState(0);
  const sel = Math.min(selected, Math.max(0, filtered.length - 1));
  const current = filtered[sel];

  const loadMore = () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const epoch = epochRef.current;
    app.history
      .recent(account, { limit: PAGE, cursor })
      .then((page) => {
        if (epochRef.current !== epoch) return; // refreshed meanwhile — stale page
        setOlder((prev) => [...prev, ...page.items]);
        setCursor(page.nextCursor);
      })
      .catch(() => flash('✗ could not load older transactions', 'danger'))
      .finally(() => setLoadingMore(false));
  };

  const explorerFor = (item: HistoryItem) => NETWORKS[account.network].explorerTx(item.hash);

  const copyField = (field: 'address' | 'hash' | 'memo') => {
    if (!current) return;
    const text =
      field === 'address' ? current.counterparty : field === 'hash' ? current.hash : current.comment;
    if (!text) {
      flash(`(no ${field} to copy)`, 'muted');
      return;
    }
    void copyToClipboard(text)
      .then(() => flash(`✓ ${field} copied`))
      .catch(() => flash('✗ could not access the clipboard', 'danger'));
  };

  useKeymap('screen', [
    { key: '↑↓', label: 'move' },
    { key: '⏎/o', label: 'explorer' },
    {
      key: 'f',
      label: `filter: ${filter}`,
      onPress: () => {
        setFilter((f) => FILTERS[(FILTERS.indexOf(f) + 1) % FILTERS.length]!);
        setSelected(0);
      },
    },
    { key: 'c', label: 'copy addr', onPress: () => copyField('address') },
    { key: 'h', label: 'hash', onPress: () => copyField('hash') },
    { key: 'm', label: 'memo', onPress: () => copyField('memo') },
    {
      key: 'o',
      onPress: () => {
        if (!current) return;
        openUrl(explorerFor(current));
        flash('✓ opened in tonviewer');
      },
    },
    {
      key: 'r',
      label: 'refresh',
      onPress: () => {
        setSelected(0);
        first.reload();
      },
    },
  ]);

  const wide = viewport.breakpoint === 'wide';
  const title = (
    <Text bold>
      History{' '}
      <Text dimColor>
        {filtered.length > 0 ? `${sel + 1}/${filtered.length}` : '0'}
        {filter !== 'all' ? ` ${symbol.bullet} ${filter}` : ''}
        {cursor ? ` ${symbol.bullet} more available` : ''}
      </Text>
    </Text>
  );

  const list = (
    <AsyncView
      state={first}
      loadingLabel="loading history…"
      emptyWhen={() => items.length === 0}
      emptyText="no transactions yet"
      emptyHint="open Receive to get your address"
    >
      {() =>
        filtered.length === 0 ? (
          <Text dimColor>nothing matches the {filter} filter — f cycles it</Text>
        ) : (
          <>
            <ListView
              items={filtered}
              selected={sel}
              onSelectionChange={setSelected}
              reservedRows={wide ? 4 : 17}
              onActivate={(item) => {
                openUrl(explorerFor(item));
                flash('✓ opened in tonviewer');
              }}
              onEndReached={loadMore}
              renderItem={(item, { selected: isSel }) => (
                <Row item={item} selected={isSel} wide={wide} />
              )}
            />
            {loadingMore ? <Text dimColor>loading older transactions…</Text> : null}
          </>
        )
      }
    </AsyncView>
  );

  if (wide) {
    return (
      <Box>
        <Panel title={title} flexGrow={1}>
          <Box marginTop={1} flexDirection="column">
            {list}
          </Box>
        </Panel>
        <Box flexDirection="column" width={46} flexShrink={0} marginLeft={1}>
          {current ? <Detail item={current} network={account.network} /> : null}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Panel title={title}>
        <Box marginTop={1} flexDirection="column">
          {list}
        </Box>
      </Panel>
      {current ? (
        <Box marginTop={1} flexDirection="column">
          <Detail item={current} network={account.network} />
        </Box>
      ) : null}
    </Box>
  );
}

function amountText(item: HistoryItem): string {
  const abs = item.amount < 0n ? -item.amount : item.amount;
  return item.asset === 'TON'
    ? formatCoin(abs)
    : `${formatAmount(abs, item.asset.decimals)} ${item.asset.symbol ?? 'jetton'}`;
}

function Row({ item, selected, wide }: { item: HistoryItem; selected: boolean; wide: boolean }) {
  const when = new Date(item.timestamp * 1000).toISOString().slice(5, 16).replace('T', ' ');
  const sign =
    item.direction === 'out' ? (
      <Text color={color.danger}>− </Text>
    ) : item.direction === 'in' ? (
      <Text color={color.success}>+ </Text>
    ) : (
      <Text dimColor>{symbol.bullet} </Text>
    );
  return (
    <Text color={selected ? color.brand : undefined} wrap="truncate">
      {`${selected ? symbol.pointer : ' '} `}
      <Text dimColor={!selected}>{when}</Text>
      {'  '}
      {sign}
      {amountText(item).padEnd(wide ? 14 : 0)}
      {item.counterparty ? (
        <Text dimColor={!selected}>{`  ${shortenAddress(item.counterparty, { head: 6, tail: 4 })}`}</Text>
      ) : null}
      {item.status === 'failed' ? <Text color={color.danger}>  ✗ failed</Text> : null}
      {item.comment && wide ? <Text dimColor>{`  "${item.comment}"`}</Text> : null}
    </Text>
  );
}

function Detail({ item, network }: { item: HistoryItem; network: NetworkId }) {
  const direction =
    item.direction === 'in' ? 'received' : item.direction === 'out' ? 'sent' : 'self';
  return (
    <Panel title="Detail">
      <Box marginTop={1} flexDirection="column">
        <Text>
          {direction} {symbol.bullet} {amountText(item)} {symbol.bullet}{' '}
          <Text color={item.status === 'failed' ? color.danger : color.success}>{item.status}</Text>
        </Text>
        <Box marginTop={1} flexDirection="column">
          {item.counterparty ? (
            <Field label={item.direction === 'out' ? 'to' : 'from'}>
              <Text color={color.address}>{item.counterparty}</Text>
            </Field>
          ) : null}
          <Field label="memo">{item.comment ? `"${item.comment}"` : '—'}</Field>
          {item.fee !== undefined ? <Field label="fee">{formatTon(item.fee)} GRAM</Field> : null}
          <Field label="time">
            {new Date(item.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19)}
          </Field>
          <Field label="hash">{item.hash}</Field>
        </Box>
        <Box marginTop={1}>
          <Text dimColor wrap="truncate-middle">
            {NETWORKS[network].explorerTx(item.hash)}
          </Text>
        </Box>
      </Box>
    </Panel>
  );
}

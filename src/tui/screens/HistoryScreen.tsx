import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { NETWORKS } from '../../config/networks.js';
import { formatAmount, formatCoin, formatTon } from '../../domain/amount.js';
import type { AccountRef, HistoryItem, NetworkId } from '../../engine/types.js';
import { copyToClipboard, openUrl } from '../../shared/system.js';
import { Loading } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';

const WINDOW = 10;

export function HistoryScreen({ account }: { account: AccountRef }) {
  const app = useApp();
  const history = useAsync(() => app.history.recent(account, { limit: 50 }), [account.address]);
  const items = history.data?.items ?? [];
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState('');

  const explorerFor = (item: HistoryItem) => NETWORKS[account.network].explorerTx(item.hash);

  const copyField = (item: HistoryItem, field: 'address' | 'hash' | 'memo') => {
    const text =
      field === 'address' ? item.counterparty : field === 'hash' ? item.hash : item.comment;
    if (!text) {
      setStatus(`(no ${field} to copy)`);
      return;
    }
    void copyToClipboard(text)
      .then(() => setStatus(`✓ ${field} copied to clipboard`))
      .catch(() => setStatus('✗ could not access the clipboard'));
  };

  useInput(
    (input, key) => {
      if (items.length === 0) return;
      const i = Math.min(selected, items.length - 1);
      if (key.upArrow || input === 'k') {
        setSelected(Math.max(0, i - 1));
        setStatus('');
      } else if (key.downArrow || input === 'j') {
        setSelected(Math.min(items.length - 1, i + 1));
        setStatus('');
      } else if (key.pageUp) {
        setSelected(Math.max(0, i - WINDOW));
      } else if (key.pageDown) {
        setSelected(Math.min(items.length - 1, i + WINDOW));
      } else if (input === 'c') {
        copyField(items[i]!, 'address');
      } else if (input === 'h') {
        copyField(items[i]!, 'hash');
      } else if (input === 'm') {
        copyField(items[i]!, 'memo');
      } else if (input === 'o' || key.return) {
        openUrl(explorerFor(items[i]!));
        setStatus('✓ opened in your browser (tonviewer)');
      }
    },
    { isActive: items.length > 0 },
  );

  if (history.loading) {
    return (
      <Box flexDirection="column">
        <Text bold>History</Text>
        <Loading />
      </Box>
    );
  }
  if (history.error) {
    return (
      <Box flexDirection="column">
        <Text bold>History</Text>
        <Text color="red">{history.error.message}</Text>
      </Box>
    );
  }
  if (items.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>History</Text>
        <Text dimColor>no transactions yet</Text>
      </Box>
    );
  }

  const sel = Math.min(selected, items.length - 1);
  const start = Math.min(Math.max(0, sel - Math.floor(WINDOW / 2)), Math.max(0, items.length - WINDOW));
  const visible = items.slice(start, start + WINDOW);
  const current = items[sel]!;

  return (
    <Box flexDirection="column">
      <Text bold>
        History{' '}
        <Text dimColor>
          ({sel + 1}/{items.length})
        </Text>
      </Text>
      {start > 0 ? <Text dimColor>{`  ↑ ${start} more`}</Text> : null}
      {visible.map((item, i) => (
        <Row key={start + i} item={item} selected={start + i === sel} />
      ))}
      {start + WINDOW < items.length ? (
        <Text dimColor>{`  ↓ ${items.length - start - WINDOW} more`}</Text>
      ) : null}
      <Box marginTop={1}>
        <Detail item={current} network={account.network} />
      </Box>
      {status ? <Text color="green">{status}</Text> : null}
      <Text dimColor>↑↓ navigate · c copy address · h hash · m memo · o/⏎ open in tonviewer · esc back</Text>
    </Box>
  );
}

function amountText(item: HistoryItem): string {
  const abs = item.amount < 0n ? -item.amount : item.amount;
  return item.asset === 'TON'
    ? formatCoin(abs)
    : `${formatAmount(abs, item.asset.decimals)} ${item.asset.symbol ?? 'jetton'}`;
}

function Row({ item, selected }: { item: HistoryItem; selected: boolean }) {
  const when = new Date(item.timestamp * 1000).toISOString().slice(5, 16).replace('T', ' ');
  const sign = item.direction === 'out' ? '−' : item.direction === 'in' ? '+' : '·';
  const failed = item.status === 'failed' ? ' [failed]' : '';
  return (
    <Text color={selected ? 'cyan' : undefined}>
      {`${selected ? '❯' : ' '} ${when}  ${sign} ${amountText(item)}${failed}`}
    </Text>
  );
}

function Detail({ item, network }: { item: HistoryItem; network: NetworkId }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text>
        {item.direction} · {amountText(item)} ·{' '}
        <Text color={item.status === 'failed' ? 'red' : 'green'}>{item.status}</Text>
      </Text>
      {item.counterparty ? (
        <Text>
          {item.direction === 'out' ? 'to  ' : 'from'}: <Text color="yellow">{item.counterparty}</Text>
        </Text>
      ) : null}
      {item.comment ? <Text>memo: &quot;{item.comment}&quot;</Text> : null}
      {item.fee !== undefined ? <Text dimColor>fee : {formatTon(item.fee)} GRAM</Text> : null}
      <Text dimColor>hash: {item.hash}</Text>
      <Text dimColor>{new Date(item.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19)}</Text>
      <Text dimColor>{NETWORKS[network].explorerTx(item.hash)}</Text>
    </Box>
  );
}

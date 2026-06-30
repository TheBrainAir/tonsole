import { Box, Text } from 'ink';
import { formatAmount, formatCoin } from '../../domain/amount.js';
import type { AccountRef, HistoryItem } from '../../engine/types.js';
import { Loading } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';

export function HistoryScreen({ account }: { account: AccountRef }) {
  const app = useApp();
  const history = useAsync(() => app.history.recent(account, { limit: 25 }), [account.address]);
  return (
    <Box flexDirection="column">
      <Text bold>History</Text>
      <Box flexDirection="column" marginTop={1}>
        {history.loading ? (
          <Loading />
        ) : history.error ? (
          <Text color="red">{history.error.message}</Text>
        ) : !history.data || history.data.items.length === 0 ? (
          <Text dimColor>no transactions yet</Text>
        ) : (
          history.data.items.map((item, i) => <Row key={i} item={item} />)
        )}
      </Box>
    </Box>
  );
}

function Row({ item }: { item: HistoryItem }) {
  const abs = item.amount < 0n ? -item.amount : item.amount;
  const text =
    item.asset === 'TON'
      ? formatCoin(abs)
      : `${formatAmount(abs, item.asset.decimals)} ${item.asset.symbol ?? 'jetton'}`;
  const when = new Date(item.timestamp * 1000).toISOString().slice(0, 16).replace('T', ' ');
  return (
    <Box>
      <Box width={18}>
        <Text dimColor>{when}</Text>
      </Box>
      {item.direction === 'out' ? (
        <Text color="red">− </Text>
      ) : item.direction === 'in' ? (
        <Text color="green">+ </Text>
      ) : (
        <Text dimColor>· </Text>
      )}
      <Text>{text}</Text>
      {item.status === 'failed' ? <Text color="red"> [failed]</Text> : null}
      {item.comment ? <Text dimColor>{`  "${item.comment}"`}</Text> : null}
    </Box>
  );
}

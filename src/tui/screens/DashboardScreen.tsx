import { Box, Text } from 'ink';
import { formatAmount, formatCoin } from '../../domain/amount.js';
import type { AccountRef, HistoryItem } from '../../engine/types.js';
import type { Screen } from '../app.js';
import { SelectList, type SelectItem } from '../components/SelectList.js';
import { Loading, TonAmount } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';

export function DashboardScreen({
  account,
  onNavigate,
  multipleAccounts,
}: {
  account: AccountRef;
  onNavigate: (screen: Screen) => void;
  multipleAccounts: boolean;
}) {
  const app = useApp();
  const balance = useAsync(() => app.balances.getTon(account), [account.address]);
  const jettons = useAsync(() => app.balances.getJettons(account), [account.address]);
  const history = useAsync(() => app.history.recent(account, { limit: 5 }), [account.address]);

  const items: SelectItem<Screen>[] = [
    { label: 'Send', value: 'send', hint: 'transfer GRAM or a jetton' },
    { label: 'Receive', value: 'receive', hint: 'address & QR' },
    { label: 'History', value: 'history' },
    { label: 'Jettons', value: 'jettons' },
    ...(multipleAccounts ? [{ label: 'Switch account', value: 'accounts' as Screen }] : []),
  ];

  return (
    <Box flexDirection="column">
      <Box>
        <Text>Balance  </Text>
        {balance.loading ? (
          <Loading />
        ) : balance.error || !balance.data ? (
          <Text color="red">unavailable</Text>
        ) : (
          <TonAmount nano={balance.data.nano} bold />
        )}
        {jettons.data && jettons.data.length > 0 ? (
          <Text dimColor>{`   · ${jettons.data.length} jettons`}</Text>
        ) : null}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>Recent</Text>
        {history.loading ? (
          <Loading />
        ) : history.error ? (
          <Text color="red">history unavailable</Text>
        ) : history.data && history.data.items.length > 0 ? (
          history.data.items.slice(0, 5).map((item, i) => <HistoryRow key={i} item={item} />)
        ) : (
          <Text dimColor>no transactions yet</Text>
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <SelectList items={items} onSelect={onNavigate} />
      </Box>
    </Box>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const abs = item.amount < 0n ? -item.amount : item.amount;
  const text =
    item.asset === 'TON'
      ? formatCoin(abs)
      : `${formatAmount(abs, item.asset.decimals)} ${item.asset.symbol ?? 'jetton'}`;
  return (
    <Text>
      {item.direction === 'out' ? (
        <Text color="red">− </Text>
      ) : item.direction === 'in' ? (
        <Text color="green">+ </Text>
      ) : (
        <Text dimColor>· </Text>
      )}
      {text}
      {item.comment ? <Text dimColor>{`  "${item.comment}"`}</Text> : null}
    </Text>
  );
}

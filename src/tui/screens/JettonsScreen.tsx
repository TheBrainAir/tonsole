import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { formatAmount } from '../../domain/amount.js';
import type { AccountRef, JettonBalance } from '../../engine/types.js';
import { copyToClipboard } from '../../shared/system.js';
import { Loading } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';
import type { SendPreset } from './SendScreen.js';

const WINDOW = 12;

export function JettonsScreen({
  account,
  onSend,
}: {
  account: AccountRef;
  onSend: (preset: SendPreset) => void;
}) {
  const app = useApp();
  const jettons = useAsync(() => app.balances.getJettons(account), [account.address]);
  const items = jettons.data ?? [];
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState('');

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
        void copyToClipboard(items[i]!.master)
          .then(() => setStatus('✓ jetton master address copied'))
          .catch(() => setStatus('✗ could not access the clipboard'));
      } else if (input === 's') {
        const j = items[i]!;
        onSend({ kind: 'jetton', master: j.master, symbol: j.symbol, decimals: j.decimals });
      }
    },
    { isActive: items.length > 0 },
  );

  if (jettons.loading) {
    return (
      <Box flexDirection="column">
        <Text bold>Jettons</Text>
        <Loading />
      </Box>
    );
  }
  if (jettons.error) {
    return (
      <Box flexDirection="column">
        <Text bold>Jettons</Text>
        <Text color="red">{jettons.error.message}</Text>
      </Box>
    );
  }
  if (items.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Jettons</Text>
        <Text dimColor>no jettons</Text>
      </Box>
    );
  }

  const sel = Math.min(selected, items.length - 1);
  const start = Math.min(Math.max(0, sel - Math.floor(WINDOW / 2)), Math.max(0, items.length - WINDOW));
  const visible = items.slice(start, start + WINDOW);

  return (
    <Box flexDirection="column">
      <Text bold>
        Jettons{' '}
        <Text dimColor>
          ({sel + 1}/{items.length})
        </Text>
      </Text>
      {start > 0 ? <Text dimColor>{`  ↑ ${start} more`}</Text> : null}
      {visible.map((jetton, i) => (
        <Row key={start + i} jetton={jetton} selected={start + i === sel} />
      ))}
      {start + WINDOW < items.length ? (
        <Text dimColor>{`  ↓ ${items.length - start - WINDOW} more`}</Text>
      ) : null}
      {status ? <Text color="green">{status}</Text> : null}
      <Text dimColor>↑↓ navigate · s send · c copy master · esc back</Text>
    </Box>
  );
}

function Row({ jetton, selected }: { jetton: JettonBalance; selected: boolean }) {
  const amount = formatAmount(jetton.amount, jetton.decimals).padStart(16);
  const symbol = jetton.symbol ?? 'jetton';
  const verified = jetton.verified ? ' ✓' : '';
  return (
    <Text color={selected ? 'cyan' : undefined}>{`${selected ? '❯' : ' '} ${amount} ${symbol}${verified}`}</Text>
  );
}

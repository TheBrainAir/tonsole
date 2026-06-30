import { Box, Text } from 'ink';
import { formatAmount } from '../../domain/amount.js';
import type { AccountRef, JettonBalance } from '../../engine/types.js';
import { Loading } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';

export function JettonsScreen({ account }: { account: AccountRef }) {
  const app = useApp();
  const jettons = useAsync(() => app.balances.getJettons(account), [account.address]);
  return (
    <Box flexDirection="column">
      <Text bold>Jettons</Text>
      <Box flexDirection="column" marginTop={1}>
        {jettons.loading ? (
          <Loading />
        ) : jettons.error ? (
          <Text color="red">{jettons.error.message}</Text>
        ) : !jettons.data || jettons.data.length === 0 ? (
          <Text dimColor>no jettons</Text>
        ) : (
          jettons.data.map((jetton, i) => <Row key={i} jetton={jetton} />)
        )}
      </Box>
    </Box>
  );
}

function Row({ jetton }: { jetton: JettonBalance }) {
  return (
    <Box>
      <Box width={20} justifyContent="flex-end">
        <Text bold>{formatAmount(jetton.amount, jetton.decimals)}</Text>
      </Box>
      <Text> {jetton.symbol ?? 'jetton'}</Text>
      {jetton.verified ? <Text color="green"> ✓</Text> : null}
    </Box>
  );
}

import { Box, Text } from 'ink';
import type { AccountRef } from '../../engine/types.js';
import { Loading } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';

export function ReceiveScreen({ account }: { account: AccountRef }) {
  const app = useApp();
  const qr = useAsync(() => app.receive.qr(account.address), [account.address]);
  return (
    <Box flexDirection="column">
      <Text bold>Receive</Text>
      <Box marginTop={1}>
        <Text color="yellow">{account.address}</Text>
      </Box>
      <Text dimColor>{app.receive.explorerUrl(account.address)}</Text>
      <Box marginTop={1}>
        {qr.loading ? (
          <Loading label="rendering QR…" />
        ) : qr.error || !qr.data ? (
          <Text color="red">could not render QR</Text>
        ) : (
          <Text>{qr.data}</Text>
        )}
      </Box>
    </Box>
  );
}

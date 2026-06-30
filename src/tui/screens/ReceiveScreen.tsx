import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { AccountRef } from '../../engine/types.js';
import { copyToClipboard, openUrl } from '../../shared/system.js';
import { Loading } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';

export function ReceiveScreen({ account }: { account: AccountRef }) {
  const app = useApp();
  const qr = useAsync(() => app.receive.qr(account.address), [account.address]);
  const [status, setStatus] = useState('');
  const explorer = app.receive.explorerUrl(account.address);

  useInput((input) => {
    if (input === 'c') {
      void copyToClipboard(account.address)
        .then(() => setStatus('✓ address copied to clipboard'))
        .catch(() => setStatus('✗ could not access the clipboard'));
    } else if (input === 'o') {
      openUrl(explorer);
      setStatus('✓ opened in your browser (tonviewer)');
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Receive</Text>
      <Box marginTop={1}>
        <Text color="yellow">{account.address}</Text>
      </Box>
      <Text dimColor>{explorer}</Text>
      <Box marginTop={1}>
        {qr.loading ? (
          <Loading label="rendering QR…" />
        ) : qr.error || !qr.data ? (
          <Text color="red">could not render QR</Text>
        ) : (
          <Text>{qr.data}</Text>
        )}
      </Box>
      {status ? <Text color="green">{status}</Text> : null}
      <Text dimColor>c copy address · o open in tonviewer · esc back</Text>
    </Box>
  );
}

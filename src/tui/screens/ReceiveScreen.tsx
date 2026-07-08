import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';
import type { AccountRef } from '../../engine/types.js';
import { copyToClipboard, openUrl } from '../../shared/system.js';
import { Panel } from '../components/Panel.js';
import { Spinner } from '../components/Spinner.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';
import { useKeymap } from '../shell/keymap.js';
import { useFlash } from '../shell/StatusBar.js';
import { useViewport } from '../shell/viewport.js';
import { color, symbol } from '../theme.js';

export function ReceiveScreen({ account }: { account: AccountRef }) {
  const app = useApp();
  const viewport = useViewport();
  const flash = useFlash();
  const qr = useAsync(async () => app.receive.qr(account.address), [account.address]);
  const [qrOnly, setQrOnly] = useState(false);
  const explorer = app.receive.explorerUrl(account.address);

  // Never print a clipped QR — a truncated code scans as garbage (or worse).
  const qrLines = qr.data ? qr.data.replace(/\n+$/, '').split('\n') : [];
  const qrRows = qrLines.length;
  const qrCols = qrLines[0]?.length ?? 0;
  const fitsBeside =
    qrRows > 0 && qrRows + 2 <= viewport.contentRows && viewport.breakpoint === 'wide';
  const fitsBelow = qrRows > 0 && qrRows + 12 <= viewport.contentRows;
  const fitsAlone = qrRows > 0 && qrRows <= viewport.contentRows;
  const needsQrOnly = !fitsBeside && !fitsBelow;

  // If the terminal grows while in QR-only mode, the normal layout fits again —
  // drop the mode (its 'f' toggle disappears together with `needsQrOnly`).
  useEffect(() => {
    if (qrOnly && !needsQrOnly) setQrOnly(false);
  }, [qrOnly, needsQrOnly]);

  useKeymap('screen', [
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
        openUrl(explorer);
        flash('✓ opened in tonviewer');
      },
    },
    ...(needsQrOnly && fitsAlone
      ? [
          {
            key: 'f',
            label: qrOnly ? 'back to details' : 'show QR',
            onPress: () => setQrOnly((v) => !v),
          },
        ]
      : []),
  ]);

  const qrBlock = qr.loading ? (
    <Spinner label="rendering QR…" />
  ) : qr.error || !qr.data ? (
    <Text color={color.danger}>could not render the QR code</Text>
  ) : (
    <Text>{qr.data}</Text>
  );

  if (qrOnly && fitsAlone) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
        {qrBlock}
      </Box>
    );
  }

  const infoPanel = (
    <Panel
      title={
        <Text bold>
          Receive <Text dimColor>{symbol.sep}your address</Text>
        </Text>
      }
      width={viewport.breakpoint === 'wide' ? 48 : undefined}
      flexShrink={0}
    >
      <Box marginTop={1} flexDirection="column">
        <Text color={color.address} wrap="wrap">
          {account.address}
        </Text>
        <Box marginTop={1}>
          <Text>Send only TON-network assets to this address.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor wrap="truncate-middle">
            {explorer}
          </Text>
        </Box>
        {needsQrOnly ? (
          <Box marginTop={1}>
            <Text dimColor>
              {fitsAlone
                ? `QR needs ~${qrRows + 2} rows — press f to show it alone`
                : `QR needs ~${qrRows + 2} rows — terminal too short (${viewport.contentRows} available)`}
            </Text>
          </Box>
        ) : null}
      </Box>
    </Panel>
  );

  if (fitsBeside) {
    return (
      <Box>
        {infoPanel}
        <Box marginLeft={2} width={Math.max(qrCols, 20)} flexDirection="column">
          {qrBlock}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {infoPanel}
      {!needsQrOnly ? (
        <Box marginTop={1} flexDirection="column">
          {qrBlock}
        </Box>
      ) : null}
    </Box>
  );
}

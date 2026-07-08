import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { COIN_SYMBOL, formatTon } from '../../domain/amount.js';
import { color, space } from '../theme.js';
import { Panel } from './Panel.js';
import { Spinner } from './Spinner.js';

/** @deprecated alias — use `Spinner` directly. */
export function Loading({ label }: { label?: string }) {
  return <Spinner label={label} />;
}

export function ErrorBox({ error }: { error: Error }) {
  return (
    <Panel title="Error" tone="danger">
      <Text>{error.message}</Text>
    </Panel>
  );
}

export function TonAmount({ nano, bold = false }: { nano: bigint; bold?: boolean }) {
  return (
    <Text bold={bold} color={color.success}>
      {formatTon(nano)} {COIN_SYMBOL}
    </Text>
  );
}

export function AddressBadge({ address }: { address: string }) {
  return <Text color={color.address}>{address}</Text>;
}

/** Two-column key/value row. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Box width={space.fieldLabelWidth} flexShrink={0}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text wrap="truncate-middle">{children}</Text>
    </Box>
  );
}

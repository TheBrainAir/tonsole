import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { COIN_SYMBOL, formatTon } from '../../domain/amount.js';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <Text dimColor>{label}</Text>;
}

export function ErrorBox({ error }: { error: Error }) {
  return (
    <Box borderStyle="round" borderColor="red" paddingX={1} flexDirection="column">
      <Text color="red" bold>
        Error
      </Text>
      <Text>{error.message}</Text>
    </Box>
  );
}

export function TonAmount({ nano, bold = false }: { nano: bigint; bold?: boolean }) {
  return (
    <Text bold={bold} color="green">
      {formatTon(nano)} {COIN_SYMBOL}
    </Text>
  );
}

export function AddressBadge({ address }: { address: string }) {
  return <Text color="yellow">{address}</Text>;
}

/** Two-column key/value row. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Box width={14}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text>{children}</Text>
    </Box>
  );
}

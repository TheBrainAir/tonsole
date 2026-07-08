import { Box, Text } from 'ink';
import { shortenAddress } from '../../domain/address.js';
import type { NetworkId } from '../../engine/types.js';
import { NetworkBadge } from '../components/Badge.js';
import { color, symbol } from '../theme.js';
import { useViewport } from './viewport.js';

export type ShellStage = 'disclaimer' | 'onboarding' | 'main';

export interface HeaderProps {
  stage: ShellStage;
  network: NetworkId;
  account?: { label?: string; address: string } | null;
  /** The TON Connect session state; `mismatch` = bound to a different account
   *  than the one currently selected (the user must not be misled about which
   *  wallet will sign). */
  connection?: { boundAddress: string; mismatch: boolean } | null;
}

/** One persistent brand row across every stage, onboarding included. */
export function Header({ stage, network, account, connection }: HeaderProps) {
  const { breakpoint } = useViewport();
  return (
    <Box justifyContent="space-between">
      <Text wrap="truncate">
        <Text bold color={color.brand}>
          tonsole
        </Text>
        <Text dimColor>{symbol.sep}</Text>
        <NetworkBadge network={network} />
        {connection ? (
          <Text color={connection.mismatch ? color.warning : color.success}>
            {connection.mismatch
              ? `${symbol.sep}${symbol.link} connected as ${shortenAddress(connection.boundAddress, { head: 6, tail: 4 })}`
              : `${symbol.sep}${symbol.link} connected`}
          </Text>
        ) : null}
      </Text>
      {stage === 'main' && account ? (
        <Text color={color.address} wrap="truncate">
          {account.label ? `${account.label}${symbol.sep}` : ''}
          {breakpoint === 'wide'
            ? account.address
            : shortenAddress(account.address, { head: 6, tail: 4 })}
        </Text>
      ) : null}
    </Box>
  );
}

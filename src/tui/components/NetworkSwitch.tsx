import { Box, Text } from 'ink';
import { useState } from 'react';
import { NETWORK_IDS } from '../../config/networks.js';
import type { NetworkId } from '../../engine/types.js';
import { color } from '../theme.js';
import { CenteredModal } from './Modal.js';

export interface NetworkSwitchProps {
  active: NetworkId;
  /** Wallet count per network, so the user knows what they are switching into. */
  counts: Record<NetworkId, number>;
  /** Set when TONSOLE_NETWORK pins the network — the choice cannot be persisted. */
  envPinnedTo?: NetworkId;
  onSelect: (network: NetworkId) => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string;
}

/**
 * Network picker. Switching rebuilds the engine, so it is deliberately a modal with an
 * explicit confirm rather than a toggle — and it always says how many wallets live on
 * the target, because wallets are network-scoped and an empty network looks broken.
 */
export function NetworkSwitch({
  active,
  counts,
  envPinnedTo,
  onSelect,
  onCancel,
  busy = false,
  error,
}: NetworkSwitchProps) {
  const [index, setIndex] = useState(Math.max(0, NETWORK_IDS.indexOf(active)));

  return (
    <CenteredModal
      title="Network"
      width={56}
      bindings={
        busy
          ? []
          : [
              { key: '↑↓', label: 'move', match: (_i, k) => k.upArrow || k.downArrow, onPress: (_i, k) =>
                  setIndex((n) => (k.upArrow ? Math.max(0, n - 1) : Math.min(NETWORK_IDS.length - 1, n + 1))) },
              { key: '⏎', label: 'switch', onPress: () => onSelect(NETWORK_IDS[index]!) },
              { key: 'esc', label: 'cancel', onPress: onCancel },
            ]
      }
    >
      <Box flexDirection="column">
        {NETWORK_IDS.map((id, i) => {
          const selected = i === index;
          const isActive = id === active;
          return (
            <Text key={id} color={selected ? color.accent : undefined} wrap="truncate">
              {selected ? '❯ ' : '  '}
              {id === 'testnet' ? <Text color={color.warning}>{id}</Text> : <Text bold={selected}>{id}</Text>}
              <Text dimColor>
                {'  '}
                {counts[id]} wallet(s)
                {isActive ? ' · active' : ''}
              </Text>
            </Text>
          );
        })}

        {envPinnedTo ? (
          <Box marginTop={1}>
            <Text color={color.warning} wrap="wrap">
              ⚠ TONSOLE_NETWORK={envPinnedTo} is set — a switch applies to this session only and
              cannot be saved. Unset it to change the default.
            </Text>
          </Box>
        ) : null}

        {busy ? (
          <Box marginTop={1}>
            <Text dimColor>Reconnecting…</Text>
          </Box>
        ) : null}

        {error ? (
          <Box marginTop={1}>
            <Text color={color.danger} wrap="wrap">
              ✗ {error}
            </Text>
          </Box>
        ) : null}
      </Box>
    </CenteredModal>
  );
}

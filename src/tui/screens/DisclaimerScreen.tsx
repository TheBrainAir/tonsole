import { Box, Text, useApp } from 'ink';
import { Panel } from '../components/Panel.js';
import { useKeymap } from '../shell/keymap.js';
import { useViewport } from '../shell/viewport.js';
import { color } from '../theme.js';

/**
 * One-time notice shown on first launch (and again if the disclaimer version is
 * bumped). The user must explicitly accept before reaching any wallet screen; the
 * acceptance is persisted in config so it is not shown again.
 */
export function DisclaimerScreen({ onAccept }: { onAccept: () => void }) {
  const { exit } = useApp();
  const viewport = useViewport();

  useKeymap('screen', [
    { key: 'y', label: 'accept & continue', onPress: () => onAccept() },
    { key: '⏎', onPress: () => onAccept() },
    { key: 'n', label: 'exit', onPress: () => exit() },
    { key: 'esc', onPress: () => exit() },
  ]);

  return (
    <Box
      flexDirection="column"
      flexGrow={viewport.isFullscreen ? 1 : undefined}
      justifyContent="center"
      alignItems="center"
    >
      <Panel
        tone="warning"
        width={Math.min(78, viewport.contentWidth)}
        title="Welcome to tonsole — please read before continuing"
      >
        <Box flexDirection="column" marginTop={1}>
          <Text>
            tonsole is free, open-source, <Text bold>experimental</Text> software provided{' '}
            <Text bold>&quot;AS IS&quot;, without warranty of any kind</Text>. It is a self-custodial{' '}
            <Text bold>hot wallet</Text>: you alone hold your keys and recovery phrase.
          </Text>
          <Box flexDirection="column" marginTop={1}>
            <Text>• The authors cannot access or recover your keys, funds, or recovery phrase.</Text>
            <Text>• Transactions are irreversible. Verify every transaction before you approve it.</Text>
            <Text>• Keep large holdings in a hardware wallet; only use funds you can afford to lose.</Text>
            <Text>• Not affiliated with the TON Foundation / TON Connect. Not financial advice.</Text>
            <Text>• You are responsible for compliance with the laws of your jurisdiction.</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Full terms: DISCLAIMER.md in the repository.</Text>
          </Box>
          <Box marginTop={1}>
            <Text>
              I understand and accept — continue? <Text color={color.accent}>[y/N]</Text>
            </Text>
          </Box>
        </Box>
      </Panel>
    </Box>
  );
}

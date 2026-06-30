import { Box, Text } from 'ink';
import type { ConnectRequest, ConnectTxRequest } from '../../engine/types.js';
import { TxSummary } from './TxSummary.js';

/** Global prompt shown over any screen when a dApp asks to connect. */
export function ConnectPrompt({ req }: { req: ConnectRequest }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold>Connection request</Text>
      <Text>
        dApp: <Text color="cyan">{req.dappName ?? 'unknown'}</Text>
      </Text>
      {req.dappUrl ? <Text dimColor>{req.dappUrl}</Text> : null}
      {req.permissions.length > 0 ? <Text dimColor>requests: {req.permissions.join(', ')}</Text> : null}
      <Box marginTop={1}>
        <Text>
          Connect? <Text color="cyan">[y/N]</Text>
        </Text>
      </Box>
    </Box>
  );
}

/** Global prompt shown over any screen when a connected dApp requests a transaction. */
export function TxPrompt({ req }: { req: ConnectTxRequest }) {
  return (
    <Box flexDirection="column">
      <Text bold>A dApp wants you to sign a transaction</Text>
      <Box marginTop={1}>
        <TxSummary preview={req.preview} />
      </Box>
      <Box marginTop={1}>
        <Text>
          Approve? <Text color="cyan">[y/N]</Text>
        </Text>
      </Box>
    </Box>
  );
}

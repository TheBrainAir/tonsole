import { Box, Text } from 'ink';
import { formatAmount, formatCoin } from '../../domain/amount.js';
import type { AssetDelta, ConnectRequest, ConnectTxRequest } from '../../engine/types.js';

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
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold>dApp transaction request</Text>
      <Box flexDirection="column" marginTop={1}>
        {req.preview.moneyFlow.outgoing.map((d, i) => (
          <Text key={`o${i}`}>
            <Text color="red">− </Text>
            {deltaText(d)} <Text dimColor>→ {d.counterparty ?? '?'}</Text>
          </Text>
        ))}
        {req.preview.moneyFlow.incoming.map((d, i) => (
          <Text key={`i${i}`}>
            <Text color="green">+ </Text>
            {deltaText(d)}
          </Text>
        ))}
        {!req.preview.ok ? <Text color="red">emulation failed</Text> : null}
        <Text dimColor>plus network gas</Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          Approve? <Text color="cyan">[y/N]</Text>
        </Text>
      </Box>
    </Box>
  );
}

function deltaText(d: AssetDelta): string {
  const abs = d.amount < 0n ? -d.amount : d.amount;
  if (d.asset === 'TON') return formatCoin(abs);
  return `${formatAmount(abs, d.asset.decimals)} ${d.asset.symbol ?? 'jetton'}`;
}

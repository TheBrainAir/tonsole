import { Box, Text } from 'ink';
import { formatAmount, formatCoin, formatTon } from '../../domain/amount.js';
import type { AssetDelta, TxPreview } from '../../engine/types.js';

const short = (a?: string): string => (a && a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : (a ?? '?'));

function who(d: AssetDelta): string {
  return d.counterpartyName ?? short(d.counterparty);
}

function amountText(d: AssetDelta): string {
  if (d.assetType === 'nft') return 'an NFT';
  const abs = d.amount < 0n ? -d.amount : d.amount;
  if (d.asset === 'TON') return formatCoin(abs);
  return `${formatAmount(abs, d.asset.decimals)} ${d.asset.symbol ?? 'tokens'}`;
}

/**
 * Plain-language emulation summary: a green/red verdict, exactly what leaves and
 * arrives, the network fee and total cost, plus any warnings. Shared by the Send
 * confirmation and the incoming dApp (TON Connect) prompt.
 */
export function TxSummary({ preview }: { preview: TxPreview }) {
  const { outgoing, incoming } = preview.moneyFlow;
  const fee = preview.estimatedFees?.total;
  const tonOut = outgoing
    .filter((d) => d.asset === 'TON')
    .reduce((sum, d) => sum + (d.amount < 0n ? -d.amount : d.amount), 0n);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={preview.ok ? 'green' : 'red'} paddingX={1}>
      <Text color={preview.ok ? 'green' : 'red'} bold>
        {preview.ok ? '✓ If you sign, this is what happens:' : '✗ This would FAIL — nothing will be sent'}
      </Text>

      {outgoing.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>you send</Text>
          {outgoing.map((d, i) => (
            <Text key={`o${i}`}>
              {'  '}
              <Text color="red">−</Text> {amountText(d)} <Text dimColor>→ {who(d)}</Text>
            </Text>
          ))}
        </Box>
      ) : null}

      {incoming.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>you receive</Text>
          {incoming.map((d, i) => (
            <Text key={`i${i}`}>
              {'  '}
              <Text color="green">+</Text> {amountText(d)} <Text dimColor>from {who(d)}</Text>
            </Text>
          ))}
        </Box>
      ) : null}

      {outgoing.length === 0 && incoming.length === 0 ? (
        <Text dimColor>no net change to your balances (likely a contract call)</Text>
      ) : null}

      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>network fee {fee !== undefined ? `≈ ${formatTon(fee)} GRAM` : '— a few mGRAM'}</Text>
        {tonOut > 0n && fee !== undefined ? (
          <Text dimColor>total leaving your wallet ≈ {formatTon(tonOut + fee)} GRAM</Text>
        ) : null}
      </Box>

      {preview.warnings.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          {preview.warnings.map((w, i) => (
            <Text key={`w${i}`} color="yellow">
              ⚠ {w}
            </Text>
          ))}
        </Box>
      ) : null}
      {!preview.ok && preview.exitCode !== undefined ? (
        <Text color="red">compute exit code {preview.exitCode}</Text>
      ) : null}
    </Box>
  );
}

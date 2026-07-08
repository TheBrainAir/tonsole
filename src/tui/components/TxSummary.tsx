import { Box, Text } from 'ink';
import { shortenAddress } from '../../domain/address.js';
import { formatAmount, formatCoin, formatTon } from '../../domain/amount.js';
import type { AssetDelta, TxPreview } from '../../engine/types.js';
import { border, color } from '../theme.js';

function who(d: AssetDelta): string {
  return d.counterpartyName ?? (d.counterparty ? shortenAddress(d.counterparty) : '?');
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

  // Three states: simulated-ok (green), simulated-fail (red), and NOT simulated
  // (yellow caution). An un-emulated tx must never look like a safe "no change".
  const borderColor = !preview.emulated ? border.warning : preview.ok ? border.success : border.danger;
  const header = !preview.emulated
    ? '⚠ This transaction could NOT be simulated — its effects are unknown.'
    : preview.ok
      ? '✓ If you sign, this is what happens:'
      : '✗ This would FAIL — nothing will be sent';

  return (
    <Box flexDirection="column" borderStyle={border.style} borderColor={borderColor} paddingX={1}>
      <Text color={borderColor} bold>
        {header}
      </Text>
      {!preview.emulated ? (
        <Text color={color.warning}>Approve only if you fully trust the source of this request.</Text>
      ) : null}

      {outgoing.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>you send</Text>
          {outgoing.map((d, i) => (
            <Text key={`o${i}`}>
              {'  '}
              <Text color={color.danger}>−</Text> {amountText(d)} <Text dimColor>→ {who(d)}</Text>
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
              <Text color={color.success}>+</Text> {amountText(d)} <Text dimColor>from {who(d)}</Text>
            </Text>
          ))}
        </Box>
      ) : null}

      {preview.emulated && outgoing.length === 0 && incoming.length === 0 ? (
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
            <Text key={`w${i}`} color={color.warning}>
              ⚠ {w}
            </Text>
          ))}
        </Box>
      ) : null}
      {!preview.ok && preview.exitCode !== undefined ? (
        <Text color={color.danger}>compute exit code {preview.exitCode}</Text>
      ) : null}
    </Box>
  );
}

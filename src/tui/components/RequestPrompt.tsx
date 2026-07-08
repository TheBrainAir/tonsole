import { Box, Text } from 'ink';
import { shortenAddress } from '../../domain/address.js';
import { formatCoin } from '../../domain/amount.js';
import type { ConnectRequest, ConnectTxRequest, ConnectTxMessage } from '../../engine/types.js';
import { color, symbol } from '../theme.js';
import { ListView } from './ListView.js';
import { CenteredModal, ConfirmBar } from './Modal.js';
import { TxSummary } from './TxSummary.js';

function MessageLine({ msg, index }: { msg: ConnectTxMessage; index: number }) {
  const tags = [msg.hasStateInit ? 'deploys contract' : null, msg.hasPayload ? 'contract call' : null]
    .filter(Boolean)
    .join(', ');
  return (
    <Text dimColor wrap="truncate">
      {`  ${index + 1}. `}
      {formatCoin(msg.amount)} → {shortenAddress(msg.to)}
      {tags ? <Text color={color.warning}>{`  [${tags}]`}</Text> : null}
    </Text>
  );
}

function resolveBindings(verb: string, onResolve: (ok: boolean) => void) {
  return [
    { key: 'y', label: verb, onPress: () => onResolve(true) },
    { key: 'n', label: 'reject', onPress: () => onResolve(false) },
    { key: 'esc', onPress: () => onResolve(false) },
  ];
}

/** Global modal shown over any screen when a dApp asks to connect. */
export function ConnectPrompt({
  req,
  signer,
  waiting = 0,
  onResolve,
}: {
  req: ConnectRequest;
  /** The account this session will sign as — the user must see WHICH wallet
   *  the dApp binds to before approving. */
  signer: { label?: string; address: string };
  /** Requests queued behind this one. */
  waiting?: number;
  onResolve: (ok: boolean) => void;
}) {
  return (
    <CenteredModal
      title="Connection request"
      layer="system"
      bindings={resolveBindings('connect', onResolve)}
      footer={<ConfirmBar verb="connect" cancelLabel="reject" />}
    >
      <Box flexDirection="column" marginTop={1}>
        <Text>
          <Text color={color.brand} bold>
            {req.dappName ?? 'unknown dApp'}
          </Text>{' '}
          wants to connect
        </Text>
        {req.dappUrl ? <Text dimColor>{req.dappUrl}</Text> : null}
        <Box flexDirection="column" marginTop={1}>
          {req.permissions.length > 0 ? (
            <Text>
              <Text dimColor>requests </Text>
              {req.permissions.join(', ')}
            </Text>
          ) : null}
          <Text>
            <Text dimColor>will sign as </Text>
            <Text color={color.address}>
              {signer.label ? `${signer.label}${symbol.sep}` : ''}
              {shortenAddress(signer.address)}
            </Text>
          </Text>
        </Box>
        {waiting > 0 ? (
          <Box marginTop={1}>
            <Text dimColor>
              +{waiting} more request{waiting === 1 ? '' : 's'} waiting
            </Text>
          </Box>
        ) : null}
      </Box>
    </CenteredModal>
  );
}

/** Global modal shown over any screen when a connected dApp requests a transaction. */
export function TxPrompt({
  req,
  waiting = 0,
  onResolve,
}: {
  req: ConnectTxRequest;
  /** Requests queued behind this one. */
  waiting?: number;
  onResolve: (ok: boolean) => void;
}) {
  const expired = req.validUntil !== undefined && req.validUntil * 1000 < Date.now();
  return (
    <CenteredModal
      title="A dApp wants you to sign a transaction"
      width={76}
      layer="system"
      bindings={resolveBindings('approve', onResolve)}
      footer={<ConfirmBar verb="approve" cancelLabel="reject" />}
    >
      {req.networkMismatch ? (
        <Text color={color.danger} bold>
          ⚠ Wrong network: dApp wants {req.networkMismatch.requested}, your wallet is on{' '}
          {req.networkMismatch.active}. Do not approve unless this is intended.
        </Text>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <TxSummary preview={req.preview} />
      </Box>
      {req.messages.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>messages it will sign{req.messages.length > 4 ? ' (↑↓ scroll)' : ''}:</Text>
          <ListView
            items={req.messages}
            maxVisible={4}
            renderItem={(m, { index }) => <MessageLine msg={m} index={index} />}
          />
        </Box>
      ) : null}
      {expired ? <Text color={color.warning}>⚠ This request has expired.</Text> : null}
      {waiting > 0 ? (
        <Text dimColor>
          +{waiting} more request{waiting === 1 ? '' : 's'} waiting
        </Text>
      ) : null}
    </CenteredModal>
  );
}

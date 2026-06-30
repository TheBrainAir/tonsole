import { Box, Text, useInput } from 'ink';
import { useRef, useState } from 'react';
import { formatAmount, formatCoin } from '../../domain/amount.js';
import { AppError } from '../../engine/errors.js';
import type { TonConnect } from '../../engine/WalletEngine.js';
import type { AccountRef, AssetDelta, ConnectRequest, ConnectTxRequest } from '../../engine/types.js';
import { SecretString } from '../../secrets/secret-string.js';
import { TextField } from '../components/TextField.js';
import { ErrorBox } from '../components/ui.js';
import { useApp } from '../context.js';

type Phase = 'unlock' | 'unlocking' | 'ready' | 'error';

export function ConnectScreen({ account }: { account: AccountRef }) {
  const app = useApp();
  const [phase, setPhase] = useState<Phase>('unlock');
  const [pass, setPass] = useState('');
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [connectReq, setConnectReq] = useState<ConnectRequest | null>(null);
  const [txReq, setTxReq] = useState<ConnectTxRequest | null>(null);
  const tcRef = useRef<TonConnect | null>(null);
  const connectResolver = useRef<((ok: boolean) => void) | null>(null);
  const txResolver = useRef<((ok: boolean) => void) | null>(null);

  const unlock = () => {
    const tc = app.engine.tonConnect?.();
    if (!tc) {
      setError(new AppError('EngineUnsupported', 'TON Connect is unavailable with the current engine.'));
      setPhase('error');
      return;
    }
    if (pass.length === 0) return;
    setPhase('unlocking');
    const passphrase = new SecretString(pass);
    let ctx;
    try {
      ctx = app.accounts.signingContext(app.accounts.resolve(account.address), passphrase);
    } catch (e) {
      passphrase.destroy();
      setError(e instanceof Error ? e : new Error(String(e)));
      setPhase('error');
      return;
    }
    tc.unlock(account, ctx)
      .then(() => {
        tcRef.current = tc;
        tc.onConnectRequest(
          (req) =>
            new Promise<boolean>((resolve) => {
              setConnectReq(req);
              connectResolver.current = resolve;
            }),
        );
        tc.onTransactionRequest(
          (req) =>
            new Promise<boolean>((resolve) => {
              setTxReq(req);
              txResolver.current = resolve;
            }),
        );
        tc.onDisconnect(() => setStatus('the dApp disconnected'));
        setPhase('ready');
        setStatus('Unlocked. Paste a dApp connection link below.');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e : new Error(String(e)));
        setPhase('error');
      })
      .finally(() => passphrase.destroy());
  };

  const submitLink = () => {
    const tc = tcRef.current;
    const url = link.trim();
    if (!tc || url.length === 0) return;
    setLink('');
    setStatus('Connecting…');
    tc.submitUrl(url)
      .then(() => setStatus('Waiting for the dApp…'))
      .catch((e: unknown) => setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`));
  };

  useInput(
    (input, key) => {
      if (connectReq) {
        if (input === 'y') resolveConnect(true);
        else if (input === 'n' || key.escape) resolveConnect(false);
      } else if (txReq) {
        if (input === 'y') resolveTx(true);
        else if (input === 'n' || key.escape) resolveTx(false);
      }
    },
    { isActive: connectReq !== null || txReq !== null },
  );

  function resolveConnect(ok: boolean) {
    connectResolver.current?.(ok);
    connectResolver.current = null;
    setConnectReq(null);
    setStatus(ok ? 'Connected ✓ — waiting for dApp requests.' : 'Connection rejected.');
  }
  function resolveTx(ok: boolean) {
    txResolver.current?.(ok);
    txResolver.current = null;
    setTxReq(null);
    setStatus(ok ? 'Approved — broadcasting…' : 'Transaction rejected.');
  }

  if (phase === 'error' && error) {
    return (
      <Box flexDirection="column">
        <ErrorBox error={error} />
        <Text dimColor>esc to go back</Text>
      </Box>
    );
  }
  if (phase === 'unlock' || phase === 'unlocking') {
    return (
      <Box flexDirection="column">
        <Text bold>TON Connect</Text>
        <Text dimColor>Unlock this wallet to approve dApp requests for the session.</Text>
        <Box marginTop={1}>
          {phase === 'unlocking' ? (
            <Text dimColor>unlocking…</Text>
          ) : (
            <TextField label="Passphrase" value={pass} onChange={setPass} onSubmit={unlock} mask focus />
          )}
        </Box>
        <Text dimColor>⏎ to unlock · esc back</Text>
      </Box>
    );
  }

  if (connectReq) {
    return (
      <Box flexDirection="column">
        <Text bold>Connection request</Text>
        <Box flexDirection="column" marginTop={1}>
          <Text>
            dApp: <Text color="cyan">{connectReq.dappName ?? 'unknown'}</Text>
          </Text>
          {connectReq.dappUrl ? <Text dimColor>{connectReq.dappUrl}</Text> : null}
          {connectReq.permissions.length > 0 ? (
            <Text dimColor>requests: {connectReq.permissions.join(', ')}</Text>
          ) : null}
        </Box>
        <Box marginTop={1}>
          <Text>
            Connect? <Text color="cyan">[y/N]</Text>
          </Text>
        </Box>
      </Box>
    );
  }

  if (txReq) {
    return (
      <Box flexDirection="column">
        <Text bold>dApp transaction request</Text>
        <Box flexDirection="column" marginTop={1}>
          {txReq.preview.moneyFlow.outgoing.map((d, i) => (
            <Text key={`o${i}`}>
              <Text color="red">− </Text>
              {deltaText(d)} <Text dimColor>→ {d.counterparty ?? '?'}</Text>
            </Text>
          ))}
          {txReq.preview.moneyFlow.incoming.map((d, i) => (
            <Text key={`i${i}`}>
              <Text color="green">+ </Text>
              {deltaText(d)}
            </Text>
          ))}
          {!txReq.preview.ok ? <Text color="red">emulation failed</Text> : null}
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

  return (
    <Box flexDirection="column">
      <Text bold>TON Connect</Text>
      {status ? <Text dimColor>{status}</Text> : null}
      <Box marginTop={1}>
        <TextField
          label="Link"
          value={link}
          onChange={setLink}
          onSubmit={submitLink}
          focus
          placeholder="paste a tc:// or https://…tonconnect link"
        />
      </Box>
      <Text dimColor>⏎ to connect · esc back</Text>
    </Box>
  );
}

function deltaText(d: AssetDelta): string {
  const abs = d.amount < 0n ? -d.amount : d.amount;
  if (d.asset === 'TON') return formatCoin(abs);
  return `${formatAmount(abs, d.asset.decimals)} ${d.asset.symbol ?? 'jetton'}`;
}

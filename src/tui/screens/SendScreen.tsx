import { Box, Text, useInput } from 'ink';
import { useRef, useState } from 'react';
import { isValidAddress } from '../../domain/address.js';
import { formatAmount, formatCoin, parseTon } from '../../domain/amount.js';
import { AppError } from '../../engine/errors.js';
import type { AccountRef, AssetDelta, TxPreview } from '../../engine/types.js';
import { SecretString } from '../../secrets/secret-string.js';
import type { SentResult } from '../../services/TransferService.js';
import { TextField } from '../components/TextField.js';
import { ErrorBox } from '../components/ui.js';
import { useApp } from '../context.js';

type Phase = 'form' | 'working' | 'confirm' | 'broadcasting' | 'done' | 'error';

export function SendScreen({ account, onDone }: { account: AccountRef; onDone: () => void }) {
  const app = useApp();
  const [field, setField] = useState<'to' | 'amount' | 'pass'>('to');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [pass, setPass] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [preview, setPreview] = useState<TxPreview | null>(null);
  const [result, setResult] = useState<SentResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const submit = () => {
    if (!isValidAddress(to)) {
      setError(new AppError('InvalidAddress', `Invalid recipient address: "${to}"`));
      setPhase('error');
      return;
    }
    let nano: bigint;
    try {
      nano = parseTon(amount);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setPhase('error');
      return;
    }
    if (pass.length === 0) {
      setField('pass');
      return;
    }

    setPhase('working');
    const passphrase = new SecretString(pass);
    const confirm = (p: TxPreview): Promise<boolean> =>
      new Promise((resolve) => {
        setPreview(p);
        setPhase('confirm');
        resolverRef.current = resolve;
      });

    app.transfers
      .sendTon({ to, amount: nano, from: account.address, passphrase, confirm })
      .then((res) => {
        setResult(res);
        setPhase('done');
      })
      .catch((e: unknown) => {
        if (AppError.is(e, 'Cancelled')) {
          setPhase('form');
          return;
        }
        setError(e instanceof Error ? e : new Error(String(e)));
        setPhase('error');
      })
      .finally(() => passphrase.destroy());
  };

  useInput(
    (input, key) => {
      if (phase === 'confirm') {
        if (input === 'y') {
          setPhase('broadcasting');
          resolverRef.current?.(true);
          resolverRef.current = null;
        } else if (input === 'n' || key.escape) {
          resolverRef.current?.(false);
          resolverRef.current = null;
        }
      } else if ((phase === 'done' || phase === 'error') && key.return) {
        onDone();
      }
    },
    { isActive: phase === 'confirm' || phase === 'done' || phase === 'error' },
  );

  if (phase === 'error' && error) {
    return (
      <Box flexDirection="column">
        <ErrorBox error={error} />
        <Text dimColor>enter to go back</Text>
      </Box>
    );
  }
  if (phase === 'done') {
    return (
      <Box flexDirection="column">
        <Text color="green" bold>
          ✓ Sent {formatCoin(parseTon(amount))}
        </Text>
        {result?.explorerUrl ? <Text dimColor>{result.explorerUrl}</Text> : null}
        <Text dimColor>enter to go back</Text>
      </Box>
    );
  }
  if (phase === 'working' || phase === 'broadcasting') {
    return <Text dimColor>{phase === 'working' ? 'emulating…' : 'broadcasting…'}</Text>;
  }
  if (phase === 'confirm' && preview) {
    return (
      <Box flexDirection="column">
        <Text bold>Confirm transaction (emulated)</Text>
        <Box flexDirection="column" marginTop={1}>
          {preview.moneyFlow.outgoing.map((d, i) => (
            <Text key={`o${i}`}>
              <Text color="red">− </Text>
              {deltaText(d)} <Text dimColor>→ {d.counterparty ?? to}</Text>
            </Text>
          ))}
          {preview.moneyFlow.incoming.map((d, i) => (
            <Text key={`i${i}`}>
              <Text color="green">+ </Text>
              {deltaText(d)}
            </Text>
          ))}
          <Text dimColor>plus network gas</Text>
        </Box>
        <Box marginTop={1}>
          <Text>
            Send? <Text color="cyan">[y/N]</Text>
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Send GRAM</Text>
      <Box marginTop={1} flexDirection="column">
        <TextField
          label="To     "
          value={to}
          onChange={setTo}
          focus={field === 'to'}
          onSubmit={() => setField('amount')}
          placeholder="recipient address"
        />
        <TextField
          label="Amount "
          value={amount}
          onChange={setAmount}
          focus={field === 'amount'}
          onSubmit={() => setField('pass')}
          placeholder="GRAM, e.g. 1.5"
        />
        <TextField
          label="Pass   "
          value={pass}
          onChange={setPass}
          focus={field === 'pass'}
          onSubmit={submit}
          mask
          placeholder="keystore passphrase"
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>⏎ next field · ⏎ on passphrase to send · esc cancel</Text>
      </Box>
    </Box>
  );
}

function deltaText(d: AssetDelta): string {
  const abs = d.amount < 0n ? -d.amount : d.amount;
  if (d.asset === 'TON') return formatCoin(abs);
  return `${formatAmount(abs, d.asset.decimals)} ${d.asset.symbol ?? 'jetton'}`;
}

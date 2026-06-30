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

/** What is being sent — set when arriving from the Jettons/NFT screens. */
export type SendPreset =
  | { kind: 'jetton'; master: string; symbol?: string; decimals: number }
  | { kind: 'nft'; address: string; name?: string };

type Phase = 'form' | 'working' | 'confirm' | 'broadcasting' | 'done' | 'error';
type Field = 'to' | 'amount' | 'comment' | 'pass';

export function SendScreen({
  account,
  onDone,
  preset,
}: {
  account: AccountRef;
  onDone: () => void;
  preset?: SendPreset | null;
}) {
  const app = useApp();
  const isNft = preset?.kind === 'nft';
  const isJetton = preset?.kind === 'jetton';
  const assetLabel = isNft
    ? `NFT ${preset.name ?? ''}`.trim()
    : isJetton
      ? (preset.symbol ?? 'jetton')
      : 'GRAM';

  const [field, setField] = useState<Field>('to');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [pass, setPass] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [preview, setPreview] = useState<TxPreview | null>(null);
  const [result, setResult] = useState<SentResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const fail = (e: unknown) => {
    setError(e instanceof Error ? e : new Error(String(e)));
    setPhase('error');
  };

  const submit = () => {
    if (!isValidAddress(to)) {
      fail(new AppError('InvalidAddress', `Invalid recipient address: "${to}"`));
      return;
    }
    if (!isNft && amount.trim() === '') {
      setField('amount');
      return;
    }
    if (pass.length === 0) {
      setField('pass');
      return;
    }

    setPhase('working');
    const passphrase = new SecretString(pass);
    const comm = comment.trim() || undefined;
    const confirm = (p: TxPreview): Promise<boolean> =>
      new Promise((resolve) => {
        setPreview(p);
        setPhase('confirm');
        resolverRef.current = resolve;
      });

    let sending: Promise<SentResult>;
    try {
      sending =
        preset?.kind === 'nft'
          ? app.transfers.sendNft({ to, nftAddress: preset.address, comment: comm, from: account.address, passphrase, confirm })
          : preset?.kind === 'jetton'
            ? app.transfers.sendJetton({ to, jettonMaster: preset.master, amount, comment: comm, from: account.address, passphrase, confirm })
            : app.transfers.sendTon({ to, amount: parseTon(amount), comment: comm, from: account.address, passphrase, confirm });
    } catch (e) {
      passphrase.destroy();
      fail(e);
      return;
    }

    sending
      .then((res) => {
        setResult(res);
        setPhase('done');
      })
      .catch((e: unknown) => {
        if (AppError.is(e, 'Cancelled')) setPhase('form');
        else fail(e);
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
          ✓ Sent {sentLabel(preset, amount)}
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
          {isNft ? <Text>sending {assetLabel}</Text> : null}
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
      <Text bold>Send {assetLabel}</Text>
      <Box marginTop={1} flexDirection="column">
        <TextField
          label="To     "
          value={to}
          onChange={setTo}
          focus={field === 'to'}
          onSubmit={() => setField(isNft ? 'comment' : 'amount')}
          placeholder="recipient address"
        />
        {!isNft ? (
          <TextField
            label="Amount "
            value={amount}
            onChange={setAmount}
            focus={field === 'amount'}
            onSubmit={() => setField('comment')}
            placeholder={isJetton ? `${assetLabel}, e.g. 10.5` : 'GRAM, e.g. 1.5'}
          />
        ) : null}
        <TextField
          label="Comment"
          value={comment}
          onChange={setComment}
          focus={field === 'comment'}
          onSubmit={() => setField('pass')}
          placeholder="optional memo"
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

function sentLabel(preset: SendPreset | null | undefined, amount: string): string {
  if (preset?.kind === 'nft') return `NFT ${preset.name ?? ''}`.trim();
  if (preset?.kind === 'jetton') return `${amount} ${preset.symbol ?? 'jetton'}`;
  return formatCoin(parseTon(amount));
}

function deltaText(d: AssetDelta): string {
  const abs = d.amount < 0n ? -d.amount : d.amount;
  if (d.asset === 'TON') return formatCoin(abs);
  return `${formatAmount(abs, d.asset.decimals)} ${d.asset.symbol ?? 'jetton'}`;
}

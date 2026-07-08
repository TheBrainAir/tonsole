import { Box, Text } from 'ink';
import { useEffect, useRef, useState } from 'react';
import { isDnsName, isValidAddress, sameAddress } from '../../domain/address.js';
import { formatAmount, formatCoin, parseAmount, parseTon } from '../../domain/amount.js';
import { AppError } from '../../engine/errors.js';
import type { AccountRef, TxPreview } from '../../engine/types.js';
import { SecretString } from '../../secrets/secret-string.js';
import type { SentResult } from '../../services/TransferService.js';
import { CenteredModal, ConfirmBar } from '../components/Modal.js';
import { Panel } from '../components/Panel.js';
import { Spinner } from '../components/Spinner.js';
import { TextField } from '../components/TextField.js';
import { TxSummary } from '../components/TxSummary.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';
import { useKeymap } from '../shell/keymap.js';
import { openUrl } from '../../shared/system.js';
import { useViewport } from '../shell/viewport.js';
import { color } from '../theme.js';

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
  const viewport = useViewport();
  const isNft = preset?.kind === 'nft';
  const isJetton = preset?.kind === 'jetton';
  const assetLabel = isNft
    ? `NFT ${preset.name ?? ''}`.trim()
    : isJetton
      ? (preset.symbol ?? 'jetton')
      : 'GRAM';

  const fields: Field[] = isNft ? ['to', 'comment', 'pass'] : ['to', 'amount', 'comment', 'pass'];
  const [field, setField] = useState<Field>('to');
  const [to, setTo] = useState('');
  const [toError, setToError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [pass, setPass] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [preview, setPreview] = useState<TxPreview | null>(null);
  const [result, setResult] = useState<SentResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  // What is available to send — shown above the form.
  const available = useAsync(async () => {
    if (isNft) return null;
    if (isJetton) {
      const all = await app.balances.getJettons(account);
      const match = all.find((j) => sameAddress(j.master, preset.master));
      return match ? `${formatAmount(match.amount, match.decimals)} ${assetLabel}` : null;
    }
    const ton = await app.balances.getTon(account);
    return formatCoin(ton.nano);
  }, [account.address]);

  const fail = (e: unknown) => {
    setError(e instanceof Error ? e : new Error(String(e)));
    setPhase('error');
  };

  // If this screen unmounts mid-confirmation (e.g. the user leaves), resolve the
  // outstanding confirm as "declined" so the engine's withMnemonic saga settles
  // and its `.finally(() => passphrase.destroy())` runs — otherwise the decrypted
  // mnemonic and passphrase would be pinned in memory indefinitely (M6).
  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    [],
  );

  const declineConfirm = () => {
    resolverRef.current?.(false);
    resolverRef.current = null;
  };

  const validateTo = (): boolean => {
    if (!isValidAddress(to) && !isDnsName(to)) {
      setToError('not a TON address or .ton name');
      setField('to');
      return false;
    }
    setToError(null);
    return true;
  };

  const validateAmount = (): boolean => {
    if (isNft) return true;
    const trimmed = amount.trim();
    if (trimmed === '') {
      setAmountError('enter an amount');
      setField('amount');
      return false;
    }
    if (!isJetton && /^(max|all)$/i.test(trimmed)) {
      setAmountError(null);
      return true;
    }
    try {
      if (isJetton) parseAmount(trimmed, preset.decimals);
      else parseTon(trimmed);
      setAmountError(null);
      return true;
    } catch {
      setAmountError(isJetton ? `not a valid ${assetLabel} amount` : 'not a valid GRAM amount');
      setField('amount');
      return false;
    }
  };

  const submit = () => {
    if (!validateTo() || !validateAmount()) return;
    if (pass.length === 0) {
      setField('pass');
      return;
    }

    setPhase('working');
    const passphrase = new SecretString(pass);
    setPass(''); // don't keep the plaintext passphrase in React state past capture
    const comm = comment.trim() || undefined;
    const confirm = (p: TxPreview): Promise<boolean> =>
      new Promise((resolve) => {
        setPreview(p);
        setPhase('confirm');
        resolverRef.current = resolve;
      });

    const wantsMax = !preset && /^(max|all)$/i.test(amount.trim());
    let sending: Promise<SentResult>;
    try {
      sending =
        preset?.kind === 'nft'
          ? app.transfers.sendNft({ to, nftAddress: preset.address, comment: comm, from: account.address, passphrase, confirm })
          : preset?.kind === 'jetton'
            ? app.transfers.sendJetton({ to, jettonMaster: preset.master, amount, comment: comm, from: account.address, passphrase, confirm })
            : wantsMax
              ? app.transfers.sendTon({ to, sendMax: true, comment: comm, from: account.address, passphrase, confirm })
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

  const move = (dir: 1 | -1) => {
    const i = fields.indexOf(field);
    setField(fields[Math.max(0, Math.min(fields.length - 1, i + dir))]!);
  };
  const advance = () => {
    // Enter validates the field it leaves, so mistakes surface immediately.
    if (field === 'to' && !validateTo()) return;
    if (field === 'amount' && !validateAmount()) return;
    if (field === 'pass') {
      submit();
      return;
    }
    move(1);
  };

  useKeymap(
    'screen',
    [
      { key: '⏎', label: field === 'pass' ? 'send' : 'next' },
      { key: 'tab', label: 'move', onPress: () => move(1) },
      { key: '↑', match: (_i, k) => k.upArrow, onPress: () => move(-1) },
      { key: '↓', match: (_i, k) => k.downArrow, onPress: () => move(1) },
    ],
    { isActive: phase === 'form' },
  );

  if (phase === 'error' && error) {
    return (
      <CenteredModal
        title="Could not send"
        tone="danger"
        bindings={[
          { key: 'r', label: 'try again', onPress: () => setPhase('form') },
          { key: '⏎', onPress: () => setPhase('form') },
          { key: 'esc', label: 'back', onPress: () => onDone() },
        ]}
      >
        <Box marginTop={1} flexDirection="column">
          <Text>{error.message}</Text>
          <Box marginTop={1}>
            <Text dimColor>Your form is kept — r edits and retries.</Text>
          </Box>
        </Box>
      </CenteredModal>
    );
  }

  if (phase === 'done') {
    return (
      <CenteredModal
        title={`✓ Sent ${sentLabel(preset, amount)}`}
        tone="success"
        bindings={[
          { key: '⏎', label: 'done', onPress: () => onDone() },
          ...(result?.explorerUrl
            ? [{ key: 'o', label: 'open in explorer', onPress: () => void openUrl(result.explorerUrl!) }]
            : []),
        ]}
      >
        {result?.explorerUrl ? (
          <Box marginTop={1}>
            <Text dimColor wrap="truncate-middle">
              {result.explorerUrl}
            </Text>
          </Box>
        ) : null}
      </CenteredModal>
    );
  }

  if (phase === 'working' || phase === 'broadcasting') {
    return (
      <CenteredModal title={`Send ${assetLabel}`} bindings={[]}>
        <Box marginTop={1}>
          <Spinner
            label={phase === 'working' ? 'emulating the transaction…' : 'broadcasting…'}
          />
        </Box>
      </CenteredModal>
    );
  }

  if (phase === 'confirm' && preview) {
    return (
      <CenteredModal
        width={76}
        bindings={[
          {
            key: 'y',
            label: 'send',
            onPress: () => {
              setPhase('broadcasting');
              resolverRef.current?.(true);
              resolverRef.current = null;
            },
          },
          { key: 'n', label: 'cancel', onPress: declineConfirm },
          { key: 'esc', onPress: declineConfirm },
        ]}
        // A dApp prompt appearing over this confirm must settle the signing saga
        // (frees the decrypted mnemonic); the form values survive.
        onMasked={declineConfirm}
        footer={
          <Text>
            Send {assetLabel}? <ConfirmBar verb="send" />
          </Text>
        }
      >
        <TxSummary preview={preview} />
      </CenteredModal>
    );
  }

  return (
    <Box
      flexDirection="column"
      flexGrow={viewport.isFullscreen ? 1 : undefined}
      justifyContent="center"
      alignItems="center"
    >
      <Panel width={Math.min(68, viewport.contentWidth)} title={`Send ${assetLabel}`}>
        <Box marginTop={1}>
          <Box width={14} flexShrink={0}>
            <Text dimColor>Available</Text>
          </Box>
          {available.loading ? (
            <Spinner label="" />
          ) : available.data ? (
            <Text color={color.success}>{available.data}</Text>
          ) : (
            <Text dimColor>—</Text>
          )}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <TextField
            label="To"
            value={to}
            onChange={(v) => {
              setTo(v);
              setToError(null);
            }}
            focus={field === 'to'}
            onSubmit={advance}
            placeholder="address or name.ton"
            error={toError}
            // 48 = panel 68 − borders/padding 4 − label 14 − cursor cell − slack
            width={Math.min(48, Math.max(16, viewport.contentWidth - 24))}
          />
          {!isNft ? (
            <TextField
              label="Amount"
              value={amount}
              onChange={(v) => {
                setAmount(v);
                setAmountError(null);
              }}
              focus={field === 'amount'}
              onSubmit={advance}
              placeholder={isJetton ? `${assetLabel}, e.g. 10.5` : 'GRAM, e.g. 1.5'}
              error={amountError}
              helper={isJetton ? undefined : "type 'max' to send everything"}
            />
          ) : null}
          <TextField
            label="Comment"
            value={comment}
            onChange={setComment}
            focus={field === 'comment'}
            onSubmit={advance}
            placeholder="optional memo"
          />
          <TextField
            label="Passphrase"
            value={pass}
            onChange={setPass}
            focus={field === 'pass'}
            onSubmit={advance}
            mask
            placeholder="keystore passphrase"
            helper="you will confirm an emulated preview before anything is sent"
          />
        </Box>
      </Panel>
    </Box>
  );
}

function sentLabel(preset: SendPreset | null | undefined, amount: string): string {
  if (preset?.kind === 'nft') return `NFT ${preset.name ?? ''}`.trim();
  if (preset?.kind === 'jetton') return `${amount} ${preset.symbol ?? 'jetton'}`;
  if (/^(max|all)$/i.test(amount.trim())) return 'all GRAM';
  return formatCoin(parseTon(amount));
}

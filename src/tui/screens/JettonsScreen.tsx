import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { NETWORKS } from '../../config/networks.js';
import { formatAmount } from '../../domain/amount.js';
import type { AccountRef } from '../../engine/types.js';
import { renderImagePreview } from '../../shared/image.js';
import { copyToClipboard, openUrl } from '../../shared/system.js';
import { GalleryRow, THUMB_H, THUMB_W } from '../components/GalleryRow.js';
import { Loading } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';
import { useImagePreviews } from '../hooks/useImagePreviews.js';
import type { SendPreset } from './SendScreen.js';

const WINDOW = 4;
const IMG_W = 20;
const IMG_H = 10;

export function JettonsScreen({
  account,
  onSend,
}: {
  account: AccountRef;
  onSend: (preset: SendPreset) => void;
}) {
  const app = useApp();
  const jettons = useAsync(() => app.balances.getJettons(account), [account.address]);
  const items = jettons.data ?? [];
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState('');

  const sel = items.length > 0 ? Math.min(selected, items.length - 1) : 0;
  const current = items[sel];
  const start = Math.min(Math.max(0, sel - Math.floor(WINDOW / 2)), Math.max(0, items.length - WINDOW));
  const visible = items.slice(start, start + WINDOW);

  const preview = useAsync(
    () => (current?.image ? renderImagePreview(current.image, { width: IMG_W, height: IMG_H }) : Promise.resolve(null)),
    [current?.image],
  );
  const getThumb = useImagePreviews(
    visible.map((j) => j.image),
    THUMB_W,
    THUMB_H,
  );

  useInput(
    (input, key) => {
      if (items.length === 0) return;
      const i = Math.min(selected, items.length - 1);
      if (key.upArrow || input === 'k') {
        setSelected(Math.max(0, i - 1));
        setStatus('');
      } else if (key.downArrow || input === 'j') {
        setSelected(Math.min(items.length - 1, i + 1));
        setStatus('');
      } else if (key.pageUp) {
        setSelected(Math.max(0, i - WINDOW));
      } else if (key.pageDown) {
        setSelected(Math.min(items.length - 1, i + WINDOW));
      } else if (input === 'c') {
        void copyToClipboard(items[i]!.master)
          .then(() => setStatus('✓ jetton master address copied'))
          .catch(() => setStatus('✗ could not access the clipboard'));
      } else if (input === 'o') {
        openUrl(NETWORKS[account.network].explorerAddress(items[i]!.master));
        setStatus('✓ opened in tonviewer');
      } else if (input === 's') {
        const j = items[i]!;
        onSend({ kind: 'jetton', master: j.master, symbol: j.symbol, decimals: j.decimals });
      }
    },
    { isActive: items.length > 0 },
  );

  if (jettons.loading) {
    return (
      <Box flexDirection="column">
        <Text bold>Jettons</Text>
        <Loading />
      </Box>
    );
  }
  if (jettons.error) {
    return (
      <Box flexDirection="column">
        <Text bold>Jettons</Text>
        <Text color="red">{jettons.error.message}</Text>
      </Box>
    );
  }
  if (items.length === 0 || !current) {
    return (
      <Box flexDirection="column">
        <Text bold>Jettons</Text>
        <Text dimColor>no jettons</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>
        Jettons{' '}
        <Text dimColor>
          ({sel + 1}/{items.length})
        </Text>
      </Text>
      {start > 0 ? <Text dimColor>{`  ↑ ${start} more`}</Text> : null}
      {visible.map((jetton, idx) => (
        <GalleryRow
          key={start + idx}
          thumb={getThumb(jetton.image)}
          selected={start + idx === sel}
          title={`${formatAmount(jetton.amount, jetton.decimals)} ${jetton.symbol ?? 'jetton'}${jetton.verified ? ' ✓' : ''}`}
          subtitle={jetton.name}
        />
      ))}
      {start + WINDOW < items.length ? (
        <Text dimColor>{`  ↓ ${items.length - start - WINDOW} more`}</Text>
      ) : null}

      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Box width={IMG_W} minHeight={IMG_H} flexShrink={0} flexDirection="column">
          {preview.loading ? (
            <Text dimColor>rendering…</Text>
          ) : preview.data ? (
            <Text>{preview.data}</Text>
          ) : (
            <Text dimColor>(no logo)</Text>
          )}
        </Box>
        <Box marginLeft={2} flexDirection="column">
          <Text bold>
            {current.symbol ?? 'jetton'} {current.verified ? <Text color="green">✓</Text> : null}
          </Text>
          {current.name ? <Text dimColor>{current.name}</Text> : null}
          <Text dimColor>{formatAmount(current.amount, current.decimals)} (decimals {current.decimals})</Text>
          <Box marginTop={1}>
            <Text color="yellow">{current.master}</Text>
          </Box>
        </Box>
      </Box>

      {status ? <Text color="green">{status}</Text> : null}
      <Text dimColor>↑↓ navigate · s send · c copy master · o tonviewer · esc back</Text>
    </Box>
  );
}
